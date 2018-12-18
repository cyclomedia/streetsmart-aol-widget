define([
    'dojo/_base/Color',
    'dojo/on',
    'dojo/_base/array',
    'esri/request',
    'esri/geometry/Point',
    'esri/geometry/Multipoint',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/geometry/Extent',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    './arcgisToGeojson',
    './utils',
    './SldFactory',
], function (
    Color,
    on,
    dojoArray,
    esriRequest,
    Point,
    Multipoint,
    Polygon,
    ScreenPoint,
    Extent,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
    Query,
    QueryTask,
    geoJsonUtils,
    utils,
    SLD,
) {
    return class LayerManager {
        constructor({ map, wkid, config, StreetSmartApi, widget }) {
            this.map = map;
            this.widget = widget;
            this.wkid = wkid;
            this.config = config;
            this.api = StreetSmartApi;
            this.defaultSymbol = {
                color: { r: 223, g: 115, b: 255, a: 1},
                size: 11,
                type: 'simplemarkersymbol',
                style: 'square',
                xoffset: 0,
                yoffset: 0,
                outline: {
                    color: { r: 26, g: 26, b: 26, a: 1 },
                    width: 2,
                    type: 'simplelinesymbol',
                    style: 'solid'
                },
            };
            this.overlays = [];
            this.requestQueue = [];
            this.requestID = 0;
            this.isQueueLoading = false;
            this.reloadQueueOnFinish = false;
        }

        addOverlaysToViewer() {
            this.removeOverlays();

            const mapLayers = _.values(this.map._layers);
            const featureLayers = _.filter(mapLayers, l => l.type === 'Feature Layer');
            const ID = ++this.requestID;
            const extent = this._calcRecordingExtent();
            const requestBundle = {ID, extent, req: []};
            _.each(featureLayers, (mapLayer) => {
                const sld = new SLD(mapLayer);
                if(sld.xml === undefined){
                    return;
                }
                if(mapLayer.hasZ) {
                    const requestObj = {mapLayer, sld, overlayID: null};
                    requestBundle.req.push(requestObj);
                } else {
                    const geojson = this.createGeoJsonForFeature({mapLayer, sld});
                    const overlay = this.api.addOverlay({
                        // sourceSrs: 'EPSG:3857',  // Broken in API
                        name: mapLayer.name,
                        sldXMLtext: sld.xml,
                        geojson
                    });

                    this.overlays.push(overlay.id);
                }
            });
            this.requestQueue.push(requestBundle);
            this._loadQueue();
        }

        _loadQueue() {
            if(this.isQueueLoading){
                this.reloadQueueOnFinish = true;
            } else {
                this.isQueueLoading = true;
                const item = this.requestQueue.pop();

                for(const request of item.req){
                    const url = `${request.mapLayer.url}/query?` +
                    'f=json&returnGeometry=true&returnZ=true&' +
                    `geometry=${encodeURI(JSON.stringify(item.extent))}&token=${request.mapLayer.credential.token}`;

                    const options = {
                        url: url,
                    };
                    esriRequest(options).then((r) => {this._handleRequest(r, item, request)});
                }

                this.requestQueue = [];
            }
        }

        _handleRequest(result, requestBundle, request) {

            if(this.reloadQueueOnFinish && !requestBundle.isComplete) {
                this.isQueueLoading = false;
                requestBundle.isComplete = true;
                this._loadQueue();
            }else if (this.reloadQueueOnFinish === false){
                const {mapLayer, sld} = request;
                const info = this.createGeoJsonForFeature({mapLayer, sld, featureSet: result});
                const overlay = this.api.addOverlay({
                    // sourceSrs: 'EPSG:3857',  // Broken in API
                    name: mapLayer.name,
                    sldXMLtext: sld.xml,
                    info
                });

                request.overlayID = overlay;
                this.overlays.push(overlay.id);

                let isBundleComplete = true;
                for(const reg of requestBundle.req){
                    if(!reg.overlayID){
                        isBundleComplete = false;
                        break
                    }
                }
                if(isBundleComplete){
                    this.isQueueLoading = false;
                }
            }

        }

        _calcRecordingExtent() {
            const recording = this.widget._panoramaViewer.getRecording();
            const {xyz, srs} = recording;
            // needs support for feet.
            const ext = new Extent(xyz[0] - 30, xyz[1] - 30, xyz[0] + 30, xyz[1] + 30, new SpatialReference(srs.split(':')[1]) )
            return ext
        }

        removeOverlays() {
            _.each(this.overlays, overlayId => {
                this.api.removeOverlay(overlayId);
            });
            this.overlays = [];
        }

        // Doesn't need to remove the overlays from the viewer,
        // as this is used when we destroy the viewer.
        reset() {
            this.overlays = [];
        }

        doesFeatureMatchCase(feature, sldCase) {
            if (!sldCase.filter) {
                return true;
            }
            return feature.properties[sldCase.filter.attribute] === sldCase.filter.value;
        }

        // Adds the SLD_DEFAULT_CASE when a feature
        // matchs none if the special cases of the SLD
        applyDefaultCaseIfNeeded(feature, sld) {
            const newFeature = _.cloneDeep(feature);
            let needsDefaultCase = true;

            for (let i=0; i < sld.cases.length ; i++) {
                const sldCase = sld.cases[i];
                const match = this.doesFeatureMatchCase(feature, sldCase);
                if (match) {
                    needsDefaultCase = false;
                    break;
                }
            }

            if (needsDefaultCase) {
                newFeature.properties['SLD_DEFAULT_CASE'] = 1;
            }

            return newFeature;
        }

        createGeoJsonForFeature({ mapLayer, sld, featureSet }) {
            const arcgisFeatureSet = featureSet || mapLayer.toJson().featureSet;
            const geojson = geoJsonUtils.arcgisToGeoJSON(arcgisFeatureSet);

            // We can't just create geoJson from the features of the maplayer.
            // To correctly apply the default case in the Unique Value Renderer,
            // we make the defaultCase a filter, and make the "other" features in the geoJSON
            // match by adding a SLD_DEFAULT_CASE:1 property.
            if (geojson.type === 'FeatureCollection' && sld.containsDefaultCase) {
                const newFeatures = geojson.features.map((feature) => {
                    return this.applyDefaultCaseIfNeeded(feature, sld);
                });
                geojson.features = newFeatures;
            }

            // Make sure the panoramaviewer knows which srs this is in.
            let wkid = _.get(arcgisFeatureSet, 'features[0].geometry.spatialReference.wkid', null);
            if (wkid) {
                wkid = wkid === 102100 ? 3857 : wkid;
                const crs = {
                    type: 'EPSG',
                    properties: {
                        code: wkid,
                    }
                };
                geojson.crs = crs;
            }
            return geojson;
        }
    }
});

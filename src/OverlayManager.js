define([
    'dojo/_base/Color',
    'dojo/on',
    'dojo/_base/array',
    'esri/geometry/Point',
    'esri/geometry/Multipoint',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    './arcgisToGeojson',
    './utils',
    './SldFactory',
], function (
    Color,
    on,
    dojoArray,
    Point,
    Multipoint,
    Polygon,
    ScreenPoint,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
    geoJsonUtils,
    utils,
    SldFactory,
) {
    return class LayerManager {
        constructor({ map, wkid, config, StreetSmartApi, arrayOverlayIds }) {

            this.map = map;
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
        }

        addOverlaysToViewer() {
            const mapLayers = _.values(this.map._layers);
            const featureLayers = _.filter(mapLayers, l => l.type === 'Feature Layer');
            _.each(featureLayers, (mapLayer) => {
                const geojson = this.createGeoJsonForFeature(mapLayer);
                const sldXMLtext = SldFactory.create({ mapLayer });

                this.api.addOverlay({
                    // sourceSrs: 'EPSG:3857',  // Broken in API
                    name: mapLayer.name,
                    sldXMLtext,
                    geojson
                });
            });
        }

        createGeoJsonForFeature(mapLayer) {
            const arcgisFeatureSet = mapLayer.toJson().featureSet;
            const geojson = geoJsonUtils.arcgisToGeoJSON(arcgisFeatureSet);

            // Add the symbol prop to the geoJson so it is styled by the SLD
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
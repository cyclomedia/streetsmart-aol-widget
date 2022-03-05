define([
    'dojo/_base/Color',
    'dojo/on',
    'esri/geometry/Point',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/renderers/UniqueValueRenderer',
    'esri/layers/FeatureLayer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    './utils',
    'esri/layers/WebTiledLayer'
], function (
    Color,
    on,
    Point,
    Polygon,
    ScreenPoint,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    SimpleRenderer,
    UniqueValueRenderer,
    FeatureLayer,
    GraphicsLayer,
    SpatialReference,
    utils,
    WebTiledLayer
) {
    return class LayerManager {
        constructor({ map, wkid, onRecordingLayerClick, addEventListener, removeEventListener, setPanoramaViewerOrientation, config, nls}) {
            this._recordingColor = new Color.fromString('#80B0FF');
            this._recordingColorDepth = new Color.fromString('#98C23C');
            this._historicRecording = new Color.fromString('#FF8D29');

            this.map = map;
            this.wkid = wkid;
            this.nls = nls;
            this.config = config;
            this.addEventListener = addEventListener;
            this.removeEventListener = removeEventListener;
            this.setPanoramaViewerOrientation = setPanoramaViewerOrientation;
            this.recordingLayer = this._createRecordingLayer({ onClick: onRecordingLayerClick });
            this.viewingConeLayer = this._createViewingConeLayer();
            this.measureLayer = this._createMeasureLayer();
            this.coverageLayer = this._createCoverageLayer();
            this.srs = new SpatialReference({ wkid });
        }

        addLayers() {
            this.map.addLayer(this.recordingLayer);
            this.map.addLayer(this.viewingConeLayer);
            this.addEventListener(this.viewingConeLayer, 'mouse-down', this.startConeInteraction.bind(this));
            this.map.addLayer(this.measureLayer);
            this.map.addLayer(this.coverageLayer);
        }

        removeLayers() {
            this.recordingLayer.clear();
            this.viewingConeLayer.clear();
            this.measureLayer.clear();
            this.map.removeLayer(this.recordingLayer);
            this.map.removeLayer(this.viewingConeLayer);
            this.map.removeLayer(this.measureLayer);
            this.map.removeLayer(this.coverageLayer);
        }

        updateRecordings(recordingData) {
            this.recordingLayer.clear();

            recordingData.map((data) => {
                const coord = new Point(data.xyz[0], data.xyz[1], this.srs);
                //GC: created a new variable to show if the current recordings are historic or not
                if(data.expiredAt){
                    data.isHistoric = true;
                }else{
                    data.isHistoric = false;
                }

                const graphic = new Graphic(coord, null, {
                    recordingId: data.id,
                    hasDepthMap: data.hasDepthMap,
                    isHistoric: data.isHistoric
                });
                this.recordingLayer.add(graphic);
            });
        };

        startConeInteraction(e) {
            this.map.disablePan();

            this._coneDragListener = this.addEventListener(this.map, 'mouse-drag', this._handleConeMoved.bind(this));
            this._coneDragEndListener = this.addEventListener(this.map, 'mouse-drag-end', this.stopConeInteraction.bind(this));
        };

        stopConeInteraction() {
            this.map.enablePan();
            this.removeEventListener(this._coneDragListener);
            this.removeEventListener(this._coneDragEndListener);
        };

        _handleConeMoved(e) {
            const yaw = this._calcYaw(this._currentPanoramaViewerPosition, e.mapPoint);
            const orientation = {
                yaw,
            };
            this.setPanoramaViewerOrientation(orientation);
        };

        _calcYaw(pt1, pt2) {
            const yDiff = pt2.y - pt1.y;
            const xDiff = pt2.x - pt1.x;
            const radians = Math.atan2(yDiff, xDiff);
            const angle = radians * 180 / Math.PI;
            return 90 - angle;
        };

        _createRecordingSymbol(color, outlinecolor = [255,255,255]) {
            const outline = new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_SOLID,
                new Color(outlinecolor),
                1
            );

            return new SimpleMarkerSymbol({
                style: 'circle',
                color,
                size: 11,
                outline,
            });
        }

        _getRecordingLayerId(){
            const nameByLocale = {
                'fr': 'Calque Enregistrement Cyclorama',
                'de': 'Cyclorama Aufnahmeorte',
                'nl': 'Cyclorama Opnamelocaties',
                'en-US': 'Cyclorama Recording Layer' ,
                'en-EN': 'Cyclorama Recording Layer'
            }
            const id = nameByLocale[this.config.locale]
            const fromNls = this.nls.recordingLayerName
            return fromNls || id || nameByLocale['en-US']
        }

        _createRecordingLayer({ onClick }) {
            const recordingCollection = {
                layerDefinition: {
                    geometryType: 'esriGeometryPoint',
                    fields: [{
                        name: 'id',
                        alias: 'ID',
                        type: 'esriFieldTypeOID'
                    }]
                },
                featureSet: null
            };
            //GC: added historic attribute to the render creator
            const renderer = new UniqueValueRenderer(this._createRecordingSymbol(this._recordingColor), 'hasDepthMap', 'isHistoric', null, ':');
            renderer.addValue('true:false', this._createRecordingSymbol(this._recordingColorDepth));
            //GC: added a new value that is only used when the historic attribute is true
            renderer.addValue('true:true', this._createRecordingSymbol(this._historicRecording));

            const layer = new FeatureLayer(recordingCollection, { id: this._getRecordingLayerId()});
            layer.setRenderer(renderer);

            on(layer, 'click', onClick);
            return layer;
        }

        _getViewingConeLayerId(){
            const nameByLocale = {
                'fr': 'Calque Visualisation Cônique',
                'de': 'Betrachtungskoni',
                'nl': 'Kijkhoeken',
                'en-US': 'Viewing Cone Layer' ,
                'en-EN': 'Viewing Cone Layer'
            }
            const id = nameByLocale[this.config.locale]
            const fromNls = this.nls.viewingConeLayerName
            return fromNls || id || nameByLocale['en-US']
        }

        _createViewingConeLayer() {
            const viewingConeCollection = {
                layerDefinition: {
                    geometryType: 'esriGeometryNull',
                    fields: [{
                        name: 'id',
                        alias: 'ID',
                        type: 'esriFieldTypeOID'
                    }]
                },
                featureSet: null
            };

            const layer = new FeatureLayer(viewingConeCollection, { id: this._getViewingConeLayerId()});
            return layer;
        }
        //GC: creating the cyclorama coverage map and adding it to the layer list
        _createCoverageLayer() {
            const layer = new WebTiledLayer("https://atlas.cyclomedia.com/webmercator/cycloramas/{z}/{x}/{y}.png", {
                "id": "CycloramaCoverage",
                "maxScale": 5,
                "opacity": 0.75
            });

            return layer;
        }

        _getMeasureLayerId(){
            const nameByLocale = {
                'fr': 'Mesures',
                'de': 'Messungen',
                'nl': 'Metingen',
                'en-US': 'Measurements',
                'en-EN': 'Measurements'
            }
            const id = nameByLocale[this.config.locale]
            const fromNls = this.nls.measurementLayerName
            return fromNls || id || nameByLocale['en-US']
        }

        _createMeasureLayer(){
            const measureCollection = {
                layerDefinition: {
                    geometryType: 'esriGeometryPoint',
                    fields: [{
                        name: 'id',
                        alias: 'ID',
                        type: 'esriFieldTypeOID'
                    }]
                },
                featureSet: null
            };

            const measureSymbol = new SimpleMarkerSymbol();
            measureSymbol.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            measureSymbol.setAngle(47);
            const renderer = new SimpleRenderer(measureSymbol);
            const layer = new FeatureLayer(measureCollection, {id: this._getMeasureLayerId()});
            layer.setRenderer(renderer);
            return layer;
        }

        updateViewingCone(panoramaViewer) {
            const recording = panoramaViewer.getRecording();
            if (!recording || !recording.xyz) {
                return;
            }

            const x = recording.xyz[0];
            const y = recording.xyz[1];

            if (!x || !y) {
                return;
            }

            this.viewingConeLayer.clear();
            const viewerColor = new Color.fromArray(panoramaViewer.getViewerColor());
            const coord = new Point(x, y, this.srs);
            // Transform local SRS to Web Mercator:
            const coordLocal = utils.transformProj4js(coord, this.map.spatialReference.wkid);

            // Street Smart API returns orientation in degrees.
            let { yaw, hFov } = panoramaViewer.getOrientation();

            // we need to use it in radians.
            yaw = utils.toRadians(yaw);
            hFov = utils.toRadians(hFov);

            const factor = 70;
            const hhFov = hFov * 0.5;
            const leftFovX = Math.sin(yaw - hhFov) * factor;
            const leftFovY = -Math.cos(yaw - hhFov) * factor;
            const rightFovX = Math.sin(yaw + hhFov) * factor;
            const rightFovY = -Math.cos(yaw + hhFov) * factor;

            const mapPt = new Point(coordLocal.x, coordLocal.y, this.map.spatialReference);
            const cPt = this.map.toScreen(mapPt);
            this._currentPanoramaViewerPosition = mapPt;

            const a = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));
            const b = this.map.toMap(new ScreenPoint(cPt.x + leftFovX, cPt.y + leftFovY));
            const c = this.map.toMap(new ScreenPoint(cPt.x + rightFovX, cPt.y + rightFovY));
            const d = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));

            const activeRecordingSymbol = new SimpleMarkerSymbol({
                style: 'circle',
                color: viewerColor,
                size: 11,
            });

            const centerDot = new Graphic(mapPt, activeRecordingSymbol);
            this.viewingConeLayer.add(centerDot);

            const outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 1), 2);

            const symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, outline, viewerColor);
            const polygon = new Polygon(this.map.spatialReference);
            polygon.addRing([[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y], [a.x, a.y]]);
            const graphic = new Graphic(polygon, symbol);

            this.viewingConeLayer.add(graphic);
            this.viewingConeLayer.setVisibility(true);
        }
    }
});

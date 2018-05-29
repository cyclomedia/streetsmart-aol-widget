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
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    './utils',
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
    GraphicsLayer,
    SpatialReference,
    utils,
) {
    return class LayerManager {
        constructor({ map, wkid, onRecordingLayerClick }) {
            this._recordingColor = new Color.fromString('#80B0FF');

            this.map = map;
            this.wkid = wkid;
            this.recordingLayer = this._createRecordingLayer({ onClick: onRecordingLayerClick });
            this.viewingConeLayer = this._createViewingConeLayer();
            this.srs = new SpatialReference({ wkid });

            map.addLayer(this.recordingLayer);
            map.addLayer(this.viewingConeLayer);
        }

        updateRecordings(recordingData) {
            this.recordingLayer.clear();

            recordingData.map((data) => {
                const coord = new Point(data.xyz[0], data.xyz[1], this.srs);

                const graphic = new Graphic(coord, null, {
                    recordingId: data.id,
                });
                this.recordingLayer.add(graphic);
            });
        }

        _createRecordingLayer({ onClick }) {
            const outline = new SimpleLineSymbol(
                SimpleLineSymbol.STYLE_SOLID,
                new Color([255, 255, 255]),
                1
            );

            const symbol = new SimpleMarkerSymbol({
                style: 'circle',
                color: this._recordingColor,
                size: 11,
                outline,
            });

            const renderer = new SimpleRenderer(symbol);
            const layer = new GraphicsLayer({ id: 'cmt_recordingLayer' });
            layer.setRenderer(renderer);

            on(layer, 'click', onClick);
            return layer;
        }

        _createViewingConeLayer() {
            const layer = new GraphicsLayer({ id: 'cmd_viewingConeLayer' });
            return layer;
        }

        updateViewingCone(panoramaViewer) {
            const viewer = panoramaViewer._viewer;
            const recording = viewer._activeRecording;
            if (!recording || !recording.xyz) {
                return;
            }

            const x = recording.xyz[0];
            const y = recording.xyz[1];

            if (!x || !y) {
                return;
            }

            this.viewingConeLayer.clear();
            const coord = new Point(x, y, this.srs);
            // Transform local SRS to Web Mercator:
            const coordLocal = utils.transformProj4js(coord, this.map.spatialReference.wkid);

            const yaw = viewer.getYaw();
            const pitch = viewer.getPitch();
            const hFov = viewer.getHFov();

            let factor = 50;
            let hhFov = hFov * 0.5;
            let leftfovx = Math.sin(yaw - hhFov) * factor;
            let leftfovy = -Math.cos(yaw - hhFov) * factor;
            let rightfovx = Math.sin(yaw + hhFov) * factor;
            let rightfovy = -Math.cos(yaw + hhFov) * factor;

            let mapPt = new Point(coordLocal.x, coordLocal.y, this.map.spatialReference);
            let cPt = this.map.toScreen(mapPt);
            // this._prePoint = mapPt;

            let a = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));
            let b = this.map.toMap(new ScreenPoint(cPt.x + leftfovx, cPt.y + leftfovy));
            let c = this.map.toMap(new ScreenPoint(cPt.x + rightfovx, cPt.y + rightfovy));
            let d = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));

            // if (!curViewer.graLoc) {
            //     let folderPath = this.folderUrl + "images/cam1.png";
            //     let ms = new PictureMarkerSymbol(folderPath, 28, 28);
            //     let marker = new Graphic(mapPt, ms);
            //     curViewer.graLoc = marker;
            //     this._lyrCameraIcon.add(marker);
            // } else {
            //     curViewer.graLoc.setGeometry(mapPt);
            // }
            // let rot = yaw * 180 / Math.PI;
            // curViewer.graLoc.symbol.setAngle(rot);

            // if (curViewer.graFOV) {
            //     this._lyrCameraIcon.remove(curViewer.graFOV);
            // }
            let ls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 1), 2);
            let rgba = panoramaViewer.getViewerColor();
            rgba[3] = 0.5; // set alpha
            let fs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, ls, new Color.fromArray(rgba));
            let polygon = new Polygon(this.map.spatialReference);
            polygon.addRing([[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y], [a.x, a.y]]);
            let graphic = new Graphic(polygon, fs);
            // curViewer.graFOV = graphic; // asfdasdfasfhsfjh
            this.viewingConeLayer.add(graphic);
            this.viewingConeLayer.setVisibility(true);
        }
    }
});
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
            const viewerColor = new Color.fromArray(panoramaViewer.getViewerColor());
            const coord = new Point(x, y, this.srs);
            // Transform local SRS to Web Mercator:
            const coordLocal = utils.transformProj4js(coord, this.map.spatialReference.wkid);

            const yaw = viewer.getYaw();
            const hFov = viewer.getHFov();

            const factor = 70;
            const hhFov = hFov * 0.5;
            const leftFovX = Math.sin(yaw - hhFov) * factor;
            const leftFovY = -Math.cos(yaw - hhFov) * factor;
            const rightFovX = Math.sin(yaw + hhFov) * factor;
            const rightFovY = -Math.cos(yaw + hhFov) * factor;

            const mapPt = new Point(coordLocal.x, coordLocal.y, this.map.spatialReference);
            const cPt = this.map.toScreen(mapPt);

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
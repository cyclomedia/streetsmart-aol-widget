define([
    'dojo/_base/Color',
    'dojo/on',
    'esri/geometry/Point',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
], function (
    Color,
    on,
    Point,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
) {
    return class LayerManager {
        constructor({ map, wkid, onRecordingLayerClick }) {
            this._recordingColor = new Color.fromString('#80B0FF');

            this.map = map;
            this.wkid = wkid;
            this.recordingLayer = this._createRecordingLayer({ onClick: onRecordingLayerClick });
            this.srs = new SpatialReference({ wkid });

            map.addLayer(this.recordingLayer);
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
            const layer = new GraphicsLayer({ id: 'recordingLayer' });
            layer.setRenderer(renderer);

            on(layer, 'click', onClick);
            return layer;
        }
    }
});
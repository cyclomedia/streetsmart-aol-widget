define([
    'dojo/_base/Color',
    'esri/geometry/Point',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/renderers/SimpleRenderer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    'esri/symbols/SimpleFillSymbol',
    'esri/geometry/Circle',
], function (
    Color,
    Point,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
    SimpleFillSymbol,
    Circle,
) {
    return class LayerManager {
        constructor({ map, wkid }) {
            this._recordingColor = new Color.fromString('#005293');

            this.map = map;
            this.wkid = wkid;
            this.recordingLayer = this._createRecordingLayer();
            this.srs = new SpatialReference({ wkid });

            map.addLayer(this.recordingLayer);
        }

        updateRecordings(recordingData) {
            console.log('updateRecordings');
            this.recordingLayer.clear();
            const recordingColor = [...this._recordingColor.toRgb(), 0.5];
            const fillColor = new Color.fromArray(recordingColor);
            recordingData.map((data) => {
                const coord = new Point(data.xyz[0], data.xyz[1], this.srs);

                const stroke = new SimpleLineSymbol(
                    SimpleLineSymbol.STYLE_SOLID,
                    new Color([255, 255, 255]),
                    1
                );

                const symbol = new SimpleMarkerSymbol(
                    SimpleMarkerSymbol.STYLE_CIRCLE,
                    9,
                    stroke,
                    fillColor,
                );

                const graphic = new Graphic(coord, symbol);
                this.recordingLayer.add(graphic);
            });
        }

        _createRecordingLayer() {
            // const recordingColor = [...this._recordingColor.toRgb(), 0.5];
            // const stroke = new SimpleLineSymbol(
            //     SimpleLineSymbol.STYLE_SOLID,
            //     new Color([255, 255, 255]),
            //     1
            // );
            //
            // const circle = new SimpleMarkerSymbol(
            //     SimpleMarkerSymbol.STYLE_CIRCLE,
            //     9,
            //     stroke,
            //     new Color.fromArray(recordingColor)
            // );
            //
            // const renderer = new SimpleRenderer(circle);
            return new GraphicsLayer({
                id: 'recordingLayer',
                // renderer,
            })
        }
    }
});
define([
    'dojo/_base/Color',
    'dojo/on',
    'dojo/_base/array',
    'esri/geometry/Point',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/Font',
    'esri/renderers/SimpleRenderer',
    'esri/layers/GraphicsLayer',
    'esri/SpatialReference',
    'esri/symbols/TextSymbol',
    'esri/geometry/Polyline',
    './utils',
], function (
    Color,
    on,
    dojoArray,
    Point,
    Polygon,
    ScreenPoint,
    Graphic,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Font,
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
    TextSymbol,
    Polyline,
    utils,
) {
    return class MeasurementHandler {
        constructor({ map, wkid, measureChange, layer, StreetSmartApi }) {
            this.map = map;
            this.wkid = wkid;
            this.measureChange = measureChange;
            this.layer = layer;
            this.StreetSmartApi = StreetSmartApi;
        }

        draw(measurementEvent) {
            if (!measurementEvent || !measurementEvent.detail) {
                return;
            }
            // Just draw everything again
            this.layer.clear();

            const {activeMeasurement} = measurementEvent.detail;
            if (!activeMeasurement || activeMeasurement.features.length === 0) {
                return;
            }

            this.drawActiveMeasurement(activeMeasurement);
        }

        drawActiveMeasurement(activeMeasurement) {
            const geometryType = activeMeasurement.features[0].geometry.type;
            switch (geometryType) {
                case 'Point':
                    return this.drawPointMeasurement(activeMeasurement);
                case 'LineString':
                    return this.drawLineMeasurement(activeMeasurement);
                case 'Polygon':
                    return this.drawPolygonMeasurement(activeMeasurement);
            }
        }

        _createPointLabel(text) {
            const bold = new Font(12, Font.WEIGHT_BOLD);
            const pointLabel = new TextSymbol(text, bold);
            pointLabel.setVerticalAlignment('bottom');
            pointLabel.setHorizontalAlignment('left');
            pointLabel.setOffset(5, 5);
            pointLabel.setColor('white');
            pointLabel.setHaloSize(2);
            pointLabel.setHaloColor(Color.fromString('black'));
            return pointLabel;
        }

        _createLineLabel(text) {
            const bold = new Font(10, Font.WEIGHT_BOLD);
            const pointLabel = new TextSymbol(text, bold);
            pointLabel.setColor('white');
            pointLabel.setHaloSize(2);
            pointLabel.setHaloColor(Color.fromString('black'));
            return pointLabel;
        }

        _transformPoints(coords) {
            const mapWkid = this.map.spatialReference.wkid;

            return coords.map(coord => {
                // Ignore incomplete forward intersection:
                if (_.includes(coord, null)) {
                    return null;
                }
                const pointViewer = new Point(coord[0], coord[1], new SpatialReference({ wkid: this.wkid }));
                const coordMap = utils.transformProj4js(pointViewer, mapWkid);
                return [coordMap.x, coordMap.y];
            })
        }

        _drawPoint(coord, index) {
            if (coord === null) {
                return;
            }

            const mapWkid = this.map.spatialReference.wkid;

            const pointMap = new Point(coord[0], coord[1], new SpatialReference({ wkid: mapWkid }));

            this.layer.add(new Graphic(pointMap, null));
            this.layer.add(new Graphic(pointMap, this._createPointLabel(`${index}`)));
        }

        _drawLines(transformedCoords, derivedData) {
            const mapWkid = this.map.spatialReference.wkid;
            const validCoords = transformedCoords.filter(coord => coord !== null);

            if (validCoords.length <= 1) {
                return;
            }

            const polyJson = {
                paths: [validCoords],
                spatialReference: { wkid: mapWkid },
            };

            const lineGeom = new Polyline(polyJson);
            const lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([236, 122, 8, 0.8]), 4);
            this.layer.add(new Graphic(lineGeom, lineSymbol));

            // Draw length labels
            _.each(transformedCoords, (coord, i) => {
                const lineLength = derivedData.segmentLengths.value[i];
                const nextCoord = transformedCoords[i + 1];

                if (lineLength === undefined || nextCoord === undefined || nextCoord === null || coord === null) {
                    return;
                }

                const x1 = (coord[0] + nextCoord[0]) / 2;
                const y1 = (coord[1] + nextCoord[1]) / 2;
                const lineLabelPoint = new Point(x1, y1, new SpatialReference({ wkid: mapWkid }));

                const readableLength = lineLength.toFixed(2) + derivedData.unit;

                this.layer.add(new Graphic(lineLabelPoint, this._createLineLabel(readableLength)));
            });
        }

        drawPointMeasurement(activeMeasurement) {
            const coords = activeMeasurement.features[0].geometry.coordinates;
            if (coords === null) {
                return;
            }

            const transformedCoords = this._transformPoints([coords]);

            this._drawPoint(transformedCoords[0], 1);
        }

        drawLineMeasurement(activeMeasurement){
            const coords = activeMeasurement.features[0].geometry.coordinates;
            const derivedData = activeMeasurement.features[0].properties.derivedData;
            if (coords === null) {
                return;
            }

            const transformedCoords = this._transformPoints(coords);

            // Draw the line between the valid points, together with the lineLength derivedData
            this._drawLines(transformedCoords, derivedData);

            // Draw the individual points in the lineMeasurement;
            _.each(transformedCoords, (coord, i) => this._drawPoint(coord, i + 1));
        }

        drawPolygonMeasurement(activeMeasurement){
            const coords = activeMeasurement.features[0].geometry.coordinates[0];
            const derivedData = activeMeasurement.features[0].properties.derivedData;

            if (coords === null) {
                return;
            }

            // const transformedCoords = this._transformPoints(coords);
            //
            // // Draw the line between the valid points, together with the lineLength derivedData
            // this._drawLines(transformedCoords, derivedData);
            //
            // // Draw the individual points in the lineMeasurement;
            // _.each(transformedCoords, (coord, i) => this._drawPoint(coord, i + 1));
            return;

            let surfacePoints = [];
            let self = this;
            const surfaceMeasurePoints = activeMeasurement.features[0].geometry.coordinates[0];
            const surfaceMeasureLength = surfaceMeasurePoints.length;
            if (surfaceMeasureLength > 0) {
                for (let i = 1; i < surfaceMeasureLength; i++) {
                    const surfaceX = surfaceMeasurePoints[i][0];
                    const surfaceY = surfaceMeasurePoints[i][1];
                    const surfacePt = new Point(surfaceX, surfaceY, new SpatialReference({wkid: self.wkid}));
                    const surfacePtMap = utils.transformProj4js(surfacePt, self.map.spatialReference.wkid);
                    let surfaceGraphics = [];
                    const surfaceGeom = new Point(surfacePtMap.x, surfacePtMap.y, new SpatialReference({wkid: 102100}));
                    const surfaceSymbol = null;
                    const surfaceMeasureNumber = new TextSymbol();
                    surfaceMeasureNumber.setText(i);
                    surfaceMeasureNumber.setVerticalAlignment("top");
                    surfaceMeasureNumber.setHorizontalAlignment("right");
                    const surfaceMeasureGraphic = Graphic(surfaceGeom, surfaceSymbol, null);
                    surfaceGraphics.push(surfaceMeasureGraphic);
                    self.layerManager.measureLayer.add(surfaceGraphics);
                    self.map.graphics.add(new Graphic(surfaceGeom, surfaceMeasureNumber));
                    if (surfaceMeasureLength > 1) {
                        let polyPoints = [surfacePtMap.x, surfacePtMap.y];
                        surfacePoints.push(polyPoints);
                    }
                }
                if (surfaceMeasureLength > 2) {
                    const polyJson = {
                        "rings": [surfacePoints],
                        "spatialReference": {wkid: 102100}
                    };
                    const surfaceMeasureLines = new Polygon(polyJson);
                    const polySymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([26, 26, 26, 1]), 2);
                    self.map.graphics.add(new Graphic(surfaceMeasureLines, polySymbol));
                    const x1 = (surfacePoints[surfaceMeasureLength - 3][0] + surfacePoints[surfaceMeasureLength - 2][0]) / 2;
                    const y1 = (surfacePoints[surfaceMeasureLength - 3][1] + surfacePoints[surfaceMeasureLength - 2][1]) / 2;
                    const lineLabelPoint = new Point(x1, y1, new SpatialReference({wkid: 102100}));
                    const value = parseFloat(activeMeasurement.features[0].properties.derivedData.segmentLengths.value[surfaceMeasureLength - 3]).toFixed(2) + activeMeasurement.features[0].properties.derivedData.unit;
                    const measureValue = new TextSymbol(value);
                    measureValue.setVerticalAlignment("middle");
                    measureValue.setHorizontalAlignment("right");
                    self.map.graphics.add(new Graphic(lineLabelPoint, measureValue));
                }
            }
        }
    }
});
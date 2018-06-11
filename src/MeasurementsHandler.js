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
    SimpleRenderer,
    GraphicsLayer,
    SpatialReference,
    TextSymbol,
    Polyline,
    utils,
) {
    return class MeasurementsHandler {
        constructor({map, wkid, measureChange, layerManager, StreetSmartApi}) {
            this.map = map;
            this.wkid = wkid;
            this.measureChange = measureChange;
            this.layerManager = layerManager;
            this.StreetSmartApi = StreetSmartApi;
        }

        draw(measurementEvent){
            if(measurementEvent && measurementEvent.detail){
                const {activeMeasurement, panoramaViewer} = measurementEvent.detail;
                if(activeMeasurement){
                    if (activeMeasurement.features[0].geometry.type === "Point") {
                        const measurementCoordinates = activeMeasurement.features[0].geometry.coordinates;
                        this.drawPoint(measurementCoordinates);
                    }if(activeMeasurement.features[0].geometry.type === "LineString") {
                        const measurementCoordinates = activeMeasurement.features[0].geometry.coordinates;
                        const coordinatesLength = measurementCoordinates.length;
                        this.drawLineString(measurementCoordinates, coordinatesLength, activeMeasurement);
                    }if(activeMeasurement.features[0].geometry.type === "Polygon") {
                        this.drawPolygon(activeMeasurement);
                    }
                    }else if (!activeMeasurement) {
                        this.map.graphics.clear();
                }
            }
        }

        drawPoint(measurementCoordinates){
            if(measurementCoordinates !== null) {
                const pointX = measurementCoordinates[0];
                const pointY = measurementCoordinates[1];
                const pt = new Point(pointX, pointY, new SpatialReference({wkid: this.wkid}));
                const ptMap = utils.transformProj4js(pt, this.map.spatialReference.wkid);
                const measureGraphics = [];
                const geom = new Point(ptMap.x, ptMap.y, new SpatialReference({wkid: 102100}));
                const symbol = null;
                const measureNumber = new TextSymbol();
                measureNumber.setText(1);
                measureNumber.setVerticalAlignment("top");
                measureNumber.setHorizontalAlignment("right");
                const measureGraphic = Graphic(geom, symbol, null);
                measureGraphics.push(measureGraphic);
                this.map.graphics.clear();
                this.layerManager.measureLayer.add(measureGraphics);
                this.map.graphics.add(new Graphic(geom, measureNumber));
            }

        }

        drawLineString(measurementCoordinates, coordinatesLength, activeMeasurement){
            let measureLinePoints = [];
            let self = this;
            dojoArray.forEach(measurementCoordinates, function (measureCoordinates, i) {
                const pointX = measureCoordinates[0];
                const pointY = measureCoordinates[1];
                const pt = new Point(pointX, pointY, new SpatialReference({wkid: self.wkid}));
                const ptMap = utils.transformProj4js(pt, self.map.spatialReference.wkid);
                const measureGraphics = [];
                const geom = new Point(ptMap.x, ptMap.y, new SpatialReference({wkid: 102100}));
                const symbol = null;
                const measureNumber = new TextSymbol();
                measureNumber.setText(i + 1);
                measureNumber.setVerticalAlignment("top");
                measureNumber.setHorizontalAlignment("right");
                const measureGraphic = Graphic(geom, symbol, null);
                measureGraphics.push(measureGraphic);
                self.layerManager.measureLayer.add(measureGraphics);
                self.map.graphics.add(new Graphic(geom, measureNumber));
                if (coordinatesLength > 1) {
                    const linePoints = [ptMap.x, ptMap.y];
                    measureLinePoints.push(linePoints);
                }
            });
            if (coordinatesLength > 1) {
                const polyJson = {
                    "paths": [measureLinePoints],
                    "spatialReference": {wkid: 102100},
                };
                const measureLines = new Polyline(polyJson);
                const symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([26, 26, 26, 1]), 2);
                self.map.graphics.add(new Graphic(measureLines, symbol));
                const x1 = (measureLinePoints[coordinatesLength - 2][0] + measureLinePoints[coordinatesLength - 1][0]) / 2;
                const y1 = (measureLinePoints[coordinatesLength - 2][1] + measureLinePoints[coordinatesLength - 1][1]) / 2;
                const lineLabelPoint = new Point(x1, y1, new SpatialReference({wkid: 102100}));
                const lengthValue = activeMeasurement.features[0].properties.derivedData.segmentLengths.value;
                const value = parseFloat(lengthValue[lengthValue.length - 1]).toFixed(2) + activeMeasurement.features[0].properties.derivedData.unit;
                const measureValue = new TextSymbol(value);
                measureValue.setVerticalAlignment("middle");
                measureValue.setHorizontalAlignment("right");
                self.map.graphics.add(new Graphic(lineLabelPoint, measureValue));
            }
        }

        drawPolygon(activeMeasurement){
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
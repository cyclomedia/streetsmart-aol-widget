define([
    'dojo/on',
    'dojo/dom',
    'esri/request',
    'esri/geometry/Point',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/SpatialReference',
    './utils',
], function (
    on,
    dom,
    esriRequest,
    Point,
    Polygon,
    ScreenPoint,
    SpatialReference,
    utils,

) {
    'use strict';

    return class FeatureLayerManager {
        constructor({ map, wkid, StreetSmartApi, widget }) {
            this.widget = widget;
            this.map = map;
            this.wkid = wkid;
            this.StreetSmartApi = StreetSmartApi;
        }

        _saveMeasurementsToLayer(layer, measurementEvent){
            console.log(layer, measurementEvent);
            //this.layerUrl = layer.url;
            const geometryType = measurementEvent.features[0].geometry.type;
            switch (geometryType) {
                case 'Point':
                    return this.pointLayer(layer, measurementEvent);
                case 'LineString':
                    return this.lineLayer(layer, measurementEvent);
                case 'Polygon':
                    return this.polygonLayer(layer, measurementEvent);
            }

        }

        _transformPoints(coords, layerWkid) {
            return coords.map(coord => {
                // Ignore incomplete forward intersection:
                if (_.includes(coord, null)) {
                    return null;
                }
                const pointViewer = new Point(coord[0], coord[1], new SpatialReference({ wkid: this.wkid }));
                const coordMap = utils.transformProj4js(pointViewer, layerWkid);
                return [coordMap.x, coordMap.y, coord[2]];
            })
        }

        pointLayer(layer, measurement){
            const coords = measurement.features[0].geometry.coordinates;
            if (coords === null) {
                return;
            }
            const zValue = coords[2];
            const layerWkid = layer.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints([coords], layerWkid);

            const pointJson = [{"geometry":
                    {
                        "x":transformedCoords[0][0],
                        "y":transformedCoords[0][1],
                        "z":zValue,
                        "spatialReference":{"wkid":layer.spatialReference.wkid}},
                "attributes":{}
            }];

            this._saveToFeatureLayer(layer, pointJson);

        }

        lineLayer(layer, measurement){
            const coords = measurement.features[0].geometry.coordinates;
            const derivedData = measurement.features[0].properties.derivedData;
            const measuredDistance = derivedData.segmentLengths.value[0].toFixed(2) + derivedData.unit;
            if (coords === null) {
                return;
            }
            const layerWkid = layer.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints(coords, layerWkid);

            const lineJson = [{"geometry":
                    {   "hasZ": true,
                        "paths":[transformedCoords],
                        "spatialReference":{"wkid":layer.spatialReference.wkid}},
                "attributes":{
                    Measurement: measuredDistance
                }
            }];

            this._saveToFeatureLayer(layer, lineJson);


        }

        polygonLayer(layer, measurement){
            const coords = measurement.features[0].geometry.coordinates[0];
            const derivedData = measurement.features[0].properties.derivedData;
            const polygonArea = derivedData.area.value.toFixed(2) + derivedData.unit;
            if (coords === null) {
                return;
            }

            const layerWkid = layer.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints(coords, layerWkid);

            const polyJson = [{"geometry":
                    {   "hasZ": true,
                        "rings":[transformedCoords],
                        "spatialReference":{"wkid":layer.spatialReference.wkid}},
                "attributes":{
                    Measurement: polygonArea
                }
            }];

            this._saveToFeatureLayer(layer, polyJson);

        }

        _saveToFeatureLayer(layer, geomJson){

            const options = {
                url: layer.url + "/applyEdits",
                content: {
                    f: "json"
                },
                handleAs: "json"
            };
            options.content.adds = JSON.stringify(geomJson);

            let layerSaveRequest = esriRequest(options, { usePost: true });

            layerSaveRequest.then(
                (response) => {
                    layer.refresh();
                    console.log("success" + JSON.stringify(response));
                }, function(error){
                    console.log("error" + error);

                });
        }
    }


});
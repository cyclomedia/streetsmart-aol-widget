define([
    'dojo/on',
    'dojo/dom',
    'esri/request',
    'esri/geometry/Point',
    'esri/geometry/Polygon',
    'esri/geometry/ScreenPoint',
    'esri/SpatialReference',
    './utils',
    './GeoTransformClient'
], function (
    on,
    dom,
    esriRequest,
    Point,
    Polygon,
    ScreenPoint,
    SpatialReference,
    utils,
    geoTransformClient
) {
    'use strict';

    return class FeatureLayerManager {
        constructor({ map, wkid, StreetSmartApi, widget, nls }) {
            this.widget = widget;
            this.map = map;
            this.wkid = wkid;
            this.StreetSmartApi = StreetSmartApi;
            this.nls = nls;
        }

        _saveMeasurementsToLayer(layer, measurementEvent, editID){
            console.log(layer, measurementEvent);
            //this.layerUrl = layer.url;
            const geometryType = measurementEvent.features[0].geometry.type;
            switch (geometryType) {
                case 'Point':
                    return this.pointLayer(layer, measurementEvent, editID);
                case 'LineString':
                    return this.lineLayer(layer, measurementEvent, editID);
                case 'Polygon':
                    return this.polygonLayer(layer, measurementEvent, editID);
            }

            return Promise.resolve(null)
        }

        _transformPoints(coords, wkid, latestWkid) {
            return coords.map(coord => {
                // Ignore incomplete forward intersection:
                if (_.includes(coord, null)) {
                    return null;
                }
                const pointViewer = new Point(coord[0], coord[1], new SpatialReference({ wkid: this.wkid }));
                //GC: use map wkid to make the measurement points on the map show up more accurately
                const coordMap = utils.transformProj4js(this.nls, pointViewer, wkid, latestWkid);
                return [coordMap.x, coordMap.y, coord[2]];
            })
        }

        pointLayer(layer, measurement, editID){
            const coords = measurement.features[0].geometry.coordinates;
            if (coords === null) {
                return;
            }
            // const zValue = coords[2];
            //GC: allowing both SRS of the layer to match up with the SRS of the widget
            // const latestWkid = layer.spatialReference.latestWkid;
            // const layerWkid = layer.spatialReference.wkid;
            const mapWkid = this.map.spatialReference.wkid;
            const mapLatestWkid = this.map.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints([coords], mapWkid, mapLatestWkid);
            const roundX = transformedCoords[0][0].toFixed(2);
            const roundY = transformedCoords[0][1].toFixed(2);
            const roundZ = transformedCoords[0][2].toFixed(2);

            const pointJson = [{"geometry":
                    {
                        "x":roundX,
                        "y":roundY,
                        "z":roundZ,
                        "spatialReference":{"wkid":mapWkid}},
                "attributes":{
                [layer.objectIdField] : editID
                }
            }];

            if(editID){
                pointJson[0].attributes[layer.objectIdField]  = editID
            }

            return this._saveToFeatureLayer(layer, pointJson, editID);

        }

        lineLayer(layer, measurement, editID){
            const coords = measurement.features[0].geometry.coordinates;
            const derivedData = measurement.features[0].properties.derivedData;
            const measuredDistance = derivedData.segmentLengths.value[0].toFixed(2) + derivedData.unit;
            if (coords === null) {
                return;
            }
            //GC: allowing both SRS of the layer to match up with the SRS of the widget
            // const latestWkid = layer.spatialReference.latestWkid;
            // const layerWkid = layer.spatialReference.wkid;
            const mapWkid = this.map.spatialReference.wkid;
            const mapLatestWkid = this.map.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints(coords, mapWkid, mapLatestWkid);

            const lineJson = [{"geometry":
                    {   "hasZ": true,
                        "paths":[transformedCoords],
                        "spatialReference":{"wkid":mapWkid}},
                "attributes":{
                    Measurement: measuredDistance
                }
            }];

            if(editID){
                lineJson[0].attributes[layer.objectIdField]  = editID
            }

            return this._saveToFeatureLayer(layer, lineJson, editID);
        }

        polygonLayer(layer, measurement, editID){
            const coords = measurement.features[0].geometry.coordinates[0];
            const derivedData = measurement.features[0].properties.derivedData;
            const polygonArea = _.get(derivedData, 'area.value', 0).toFixed(2) + derivedData.unit;
            if (coords === null) {
                return;
            }
            //GC: allowing both SRS of the layer to match up with the SRS of the widget
            // const latestWkid = layer.spatialReference.latestWkid;
            // const layerWkid = layer.spatialReference.wkid;
            const mapWkid = this.map.spatialReference.wkid;
            const mapLatestWkid = this.map.spatialReference.latestWkid;
            const transformedCoords = this._transformPoints(coords, mapWkid, mapLatestWkid);

            const polyJson = [{"geometry":
                    {   "hasZ": true,
                        "rings":[transformedCoords],
                        "spatialReference":{"wkid":mapWkid}},
                "attributes":{
                    Measurement: polygonArea
                }
            }];

            if(editID){
                polyJson[0].attributes[layer.objectIdField]  = editID
            }

            return this._saveToFeatureLayer(layer, polyJson, editID);

        }

        _saveToFeatureLayer(layer, geomJson, editID){
            const options = {
                url: layer.url + "/applyEdits",
                content: {
                    f: "json"
                },
                handleAs: "json"
            };
            if(!editID){
                options.content.adds = JSON.stringify(geomJson);
            } else {
                options.content.updates = JSON.stringify(geomJson);
            }

            let layerSaveRequest = esriRequest(options, { usePost: true});

            let zAlert = this.nls.zAlert;

            return layerSaveRequest.then(
                (response) => {
                    layer.refresh();
                    console.log("success" + JSON.stringify(response));
                    return response
                }, function(error){
                    console.log(error);
                    //GC: warning message in case the feature is not z enabled so measurement cannot be saved
                    if(layer.hasZ === false){
                        alert(zAlert);
                    }
                });
        }
    }


});

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
    './utils',
    './sldStyling',
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
    utils,
    sldStyling,
) {
    return class LayerManager {
        constructor({ map, wkid, config, StreetSmartApi, arrayOverlayIds }) {

            this.map = map;
            this.wkid = wkid;
            this.config = config;
            this.StreetSmartApi = StreetSmartApi;
            this.arrayOverlayIds = arrayOverlayIds;
        }

        _overlayFeatures() {
            let self = this;
            let mapLayers = self.map._layers;
            let layerName;
            let overlaySrs;
            if (self.config.srs === "EPSG:28992") {
                overlaySrs = new SpatialReference({wkid: parseInt(self.config.srs.substr(5))})
            } else {
                overlaySrs = new SpatialReference({wkid: 102100});
            }
            const featureLayStr = 'Feature Layer';
            const esriGeometryPointStr = 'esriGeometryPoint';
            const esriGeometryMultipointStr = 'esriGeometryMultipoint';
            const esriPolyLineStr = "esriGeometryPolyline";
            const esriGeometryPolygonStr = "esriGeometryPolygon";
            const markSymbol = "simplemarkersymbol";
            const imageSymbol = "picturemarkersymbol";
            const lineSymbol = "simplelinesymbol";
            const esriLineSymbol = "esriSLS";
            const esriPictureSymbol = "esriPMS";
            const esriPolySymbol = "esriSFS";
            const polygonSymbol = "simplefillsymbol";
            for (let key in mapLayers) {
                let featurePoints = [];
                let featureLines = [];
                let featurePolys = [];
                if (!mapLayers.hasOwnProperty(key)) {
                    continue;
                }
                //if (mapLayers[key].type) {
                const mapLayer = mapLayers[key];
                if (mapLayer.type === featureLayStr) {
                    layerName = mapLayer.name;
                    let layerUrl = mapLayer.url;
                    let layerSymbology;
                    const methodParams = {
                        layerName,
                        featurePoints,
                        featureLines,
                        featurePolys,
                        overlaySrs,
                        esriGeometryPointStr,
                        esriGeometryMultipointStr,
                        esriPolyLineStr,
                        esriGeometryPolygonStr,
                        markSymbol,
                        imageSymbol,
                        lineSymbol,
                        esriLineSymbol,
                        esriPictureSymbol,
                        esriPolySymbol,
                        polygonSymbol,
                        mapLayer,
                        layerSymbology,
                    };
                    try {
                        layerSymbology = mapLayer.renderer.getSymbol();
                        methodParams.layerSymbology = layerSymbology;
                        methodParams.uniqueStyling = false;
                        this._layerSymbology(methodParams);
                    } catch (err) {
                        layerSymbology = mapLayer.renderer.defaultSymbol;
                        if(layerSymbology) {
                            methodParams.layerSymbology = layerSymbology;
                            this._layerSymbology(methodParams);
                        }else{
                            layerSymbology = {
                                "color":{"r":223,"g":115,"b":255,"a":1},
                                "size":11,
                                "type":"simplemarkersymbol",
                                "style":"square",
                                "outline":{"color":{"r":26,"g":26,"b":26,"a":1},
                                    "width":2,"type":"simplelinesymbol",
                                    "style":"solid"},
                                "xoffset":0,
                                "yoffset":0
                            };
                            methodParams.layerSymbology = layerSymbology;
                            this._layerSymbology(methodParams);
                        }

                    }

                }
            }
        }

        _layerSymbology(
            {
            layerName,
            featurePoints,
            featureLines,
            featurePolys,
            overlaySrs,
            esriGeometryPointStr,
            esriGeometryMultipointStr,
            esriPolyLineStr,
            esriGeometryPolygonStr,
            markSymbol,
            imageSymbol,
            lineSymbol,
            esriLineSymbol,
            esriPictureSymbol,
            esriPolySymbol,
            polygonSymbol,
            mapLayer,
            layerSymbology
        }
        ) {
            const self = this;
            const sldName = mapLayer.name;
            const sldTitle = mapLayer.id;
            let fillColor;
            if (layerSymbology.color) {
                try {
                    fillColor = layerSymbology.color.toHex();
                } catch (err) {
                    let rgba = new Color.fromArray(layerSymbology.color);
                    fillColor = rgba.toHex();
                }

            }
            let strokeColor, strokeWidth, imageType, imageUrl, imageSize, lineWidth, polygonLength;
            const overlayParameters = {
                layerName,
                featurePoints,
                featureLines,
                featurePolys,
                overlaySrs,
                esriGeometryPointStr,
                esriGeometryMultipointStr,
                esriPolyLineStr,
                esriGeometryPolygonStr,
                markSymbol,
                imageSymbol,
                lineSymbol,
                esriLineSymbol,
                esriPictureSymbol,
                esriPolySymbol,
                polygonSymbol,
                mapLayer,
                layerSymbology,
                strokeColor,
                strokeWidth,
                imageType,
                imageUrl,
                imageSize,
                lineWidth,
                polygonLength,
                fillColor,
                sldName,
                sldTitle
            };
            if (mapLayer.geometryType === esriGeometryPointStr || mapLayer.geometryType === esriGeometryMultipointStr) {
                this._displayPointFeatures(overlayParameters);
            }
            else if (mapLayer.geometryType === esriPolyLineStr) {
                this._displayLineFeatures(overlayParameters);
            }
            else if (mapLayer.geometryType === esriGeometryPolygonStr) {
                this._displayPolygonFeatures(overlayParameters);
            }
        }

        _displayPointFeatures(overlayParameters){
            let symbolShape, pointStyling;
            let self = this;
            if (overlayParameters.layerSymbology.type === overlayParameters.markSymbol) {
                if (overlayParameters.layerSymbology.outline) {
                    const toConvert = overlayParameters.layerSymbology.outline.color;
                    const arrayColor = "rgba(" +[toConvert.r, toConvert.g, toConvert.b, toConvert.a].toString() + ")";
                    overlayParameters.strokeColor = this.rgbaToHex(arrayColor);
                    overlayParameters.strokeWidth = overlayParameters.layerSymbology.outline.width;
                    symbolShape = overlayParameters.layerSymbology.style;
                }
            } else if (overlayParameters.layerSymbology.type === overlayParameters.imageSymbol ||
                overlayParameters.layerSymbology.type === overlayParameters.esriPictureSymbol) {
                overlayParameters.imageType = overlayParameters.layerSymbology.contentType;
                const imageDat = overlayParameters.layerSymbology.imageData;
                const  imageLink = overlayParameters.layerSymbology.url;
                const imgDatValue = this._imageUrlValidation(imageDat);
                if (imgDatValue === false) {
                    overlayParameters.imageUrl = imageLink;
                    overlayParameters.imageUrl = " ' " + overlayParameters.imageUrl + " ' ";
                } else {
                    overlayParameters.imageUrl = imageDat;
                    overlayParameters.imageUrl = " ' " + overlayParameters.imageUrl + " ' ";
                }
                overlayParameters.imageSize = overlayParameters.layerSymbology.size;
                symbolShape = "image";
            }
            //Here i read each point from the feature layer
            dojoArray.forEach(overlayParameters.mapLayer.graphics, function (pointFeature, i) {
                const srsViewer = parseInt(self.config.srs.substr(5));
                const ptViewer = utils.transformProj4js(pointFeature.geometry, srsViewer);
                const ptCoordinate = [ptViewer.x, ptViewer.y];
                const properties = {
                    symbol: symbolShape
                };
                let featurePtViewer = {
                    "type": "Feature",
                    properties,
                    "geometry": {
                        "type": "Point",
                        "coordinates": ptCoordinate
                    }
                };
                overlayParameters.featurePoints.push(featurePtViewer);
            });

            //create a geojson here for the cyclorama
            let featureGeoJSON =  this._featureGoeJsonObject(overlayParameters.featurePoints);

            let overlayOptions;
            if (symbolShape) {
                pointStyling = sldStyling.applySldStyling(overlayParameters.fillColor, overlayParameters.strokeColor,
                    overlayParameters.strokeWidth, symbolShape, overlayParameters.sldName,
                    overlayParameters.sldTitle, overlayParameters.imageType, overlayParameters.imageUrl,
                    overlayParameters.imageSize, overlayParameters.lineWidth, overlayParameters.polygonLength);

                overlayOptions = this._overlayOptionsObject(overlayParameters.layerName, featureGeoJSON, pointStyling);

            } else {
                overlayOptions = {
                    name: overlayParameters.layerName,
                    geojson: featureGeoJSON,
                    sourceSrs: this.config.srs
                };
            }
            this._removeOverlayFeatures(overlayParameters.sldName);
            this._addOverlayFeatures(overlayOptions, overlayParameters.sldName);
        }

        _displayLineFeatures(overlayParameters){
            let self = this;
            const symbolLine = "line";
            const properties = {
                symbol: symbolLine
            };
            dojoArray.forEach(overlayParameters.mapLayer.graphics, function (pointFeature, i) {
                let lineCoords = [];
                dojoArray.forEach(pointFeature.geometry.paths[0], function (featurePoint, i) {
                    const mapPt = new Point(featurePoint[0], featurePoint[1], overlayParameters.overlaySrs);
                    const srsViewer = parseInt(self.config.srs.substr(5));
                    const ptViewer = utils.transformProj4js(mapPt, srsViewer);
                    const lineCoordinate = [ptViewer.x, ptViewer.y];
                    lineCoords.push(lineCoordinate);
                });

                let featureLineViewer = {
                    "type": "Feature",
                    properties,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": lineCoords
                    }
                };
                overlayParameters.featureLines.push(featureLineViewer);
            });

            let featureGeoJSON =  this._featureGoeJsonObject(overlayParameters.featureLines);

            let overlayOptions, lineStyling;
            if (overlayParameters.layerSymbology.type === overlayParameters.lineSymbol ||
                overlayParameters.layerSymbology.type === overlayParameters.esriLineSymbol)
            {
                overlayParameters.lineWidth = overlayParameters.layerSymbology.width;
                lineStyling = sldStyling.applySldStyling(overlayParameters.fillColor, overlayParameters.strokeColor,
                    overlayParameters.strokeWidth, symbolLine, overlayParameters.sldName, overlayParameters.sldTitle,
                    overlayParameters.imageType, overlayParameters.imageUrl, overlayParameters.imageSize,
                    overlayParameters.lineWidth, overlayParameters.polygonLength);

                overlayOptions = this._overlayOptionsObject(overlayParameters.layerName, featureGeoJSON, lineStyling);
            }

            this._removeOverlayFeatures(overlayParameters.sldName);
            this._addOverlayFeatures(overlayOptions, overlayParameters.sldName);
        }

        _displayPolygonFeatures(overlayParameters){
            let self = this;
            const symbolPoly = "polygon";
            dojoArray.forEach(overlayParameters.mapLayer.graphics, function (pointFeature, i) {
                let polyCoords = [];
                const polyFeatureArray = pointFeature.geometry.rings[0];
                overlayParameters.polygonLength = polyFeatureArray.length;
                dojoArray.forEach(polyFeatureArray, function (featurePoint, i) {
                    const mapPt = new Point(featurePoint[0], featurePoint[1], overlayParameters.overlaySrs);
                    const srsViewer = parseInt(self.config.srs.substr(5));
                    const ptViewer = utils.transformProj4js(mapPt, srsViewer);
                    const ptCoordinate = [ptViewer.x, ptViewer.y];
                    polyCoords.push(ptCoordinate);
                });

                const properties = {
                    symbol: symbolPoly,
                    polygonLength: overlayParameters.polygonLength
                };

                const featurePolyViewer = {
                    "type": "Feature",
                    properties,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [polyCoords]
                    }
                };
                overlayParameters.featurePolys.push(featurePolyViewer);
            });

            let featureGeoJSON =  this._featureGoeJsonObject(overlayParameters.featurePolys);

            let overlayOptions, polyStyling;
            if (overlayParameters.layerSymbology.type === overlayParameters.polygonSymbol || overlayParameters.esriPolySymbol) {
                if (overlayParameters.layerSymbology.outline) {
                    let outColor = overlayParameters.layerSymbology.outline.color;
                    let colorArray = "rgba(" + [outColor.r, outColor.g, outColor.b, outColor.a].toString() + ")";
                    overlayParameters.strokeColor = this.rgbaToHex(colorArray);
                    overlayParameters.strokeWidth = overlayParameters.layerSymbology.outline.width;
                }
                polyStyling = sldStyling.applySldStyling(overlayParameters.fillColor, overlayParameters.strokeColor,
                    overlayParameters.strokeWidth, symbolPoly, overlayParameters.sldName,
                    overlayParameters.sldTitle, overlayParameters.imageType, overlayParameters.imageUrl,
                    overlayParameters.imageSize, overlayParameters.lineWidth, overlayParameters.polygonLength);

                overlayOptions = this._overlayOptionsObject(overlayParameters.layerName, featureGeoJSON, polyStyling);
            }
            this._removeOverlayFeatures(overlayParameters.sldName);
            this._addOverlayFeatures(overlayOptions, overlayParameters.sldName);
        }

        _featureGoeJsonObject(overlayFeatures){

            const featureGeoJSON = {
                "type": "FeatureCollection",
                "features": overlayFeatures
            };

            return featureGeoJSON;

        }

        _overlayOptionsObject(layerName, featureGeoJSON, featureStyling ){

            const overlayLayerOptions = {
                name: layerName,
                geojson: featureGeoJSON,
                sourceSrs: this.config.srs,
                sldXMLtext: featureStyling
            };
            return overlayLayerOptions;

        }

        _removeOverlayFeatures(sldName){
            if (this.arrayOverlayIds[sldName]) {
                this.StreetSmartApi.removeOverlay(this.arrayOverlayIds[sldName]);
            }
        }

        _addOverlayFeatures(overlayOptions, sldName){
            const overlay = this.StreetSmartApi.addOverlay(overlayOptions);
            this.arrayOverlayIds[sldName] = overlay.id;
        }



        rgbaToHex(rgb) {
            rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
            return (rgb && rgb.length === 4) ? "#" +
                ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
                ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
                ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
        }

        _imageUrlValidation(imageURL) {

            let urlRegExp = new RegExp("^http(s?)\:\/\/[0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*(:(0-9)*)*(\/?)([a-zA-Z0-9\-\.\?\,\'\/\\\+&amp;%\$#_]*)?$");
            return urlRegExp.test(imageURL);
        }


    }
});
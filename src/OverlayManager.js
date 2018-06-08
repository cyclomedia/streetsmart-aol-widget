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
    './arcgisToGeojson',
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
    geoJsonUtils,
    utils,
    sldStyling,
) {
    return class LayerManager {
        constructor({ map, wkid, config, StreetSmartApi, arrayOverlayIds }) {

            this.map = map;
            this.wkid = wkid;
            this.config = config;
            this.api = StreetSmartApi;
            this.defaultSymbol = {
                color: { r: 223, g: 115, b: 255, a: 1},
                size: 11,
                type: 'simplemarkersymbol',
                style: 'square',
                xoffset: 0,
                yoffset: 0,
                outline: {
                    color: { r: 26, g: 26, b: 26, a: 1 },
                    width: 2,
                    type: 'simplelinesymbol',
                    style: 'solid'
                },
            };
        }

        addOverlaysToViewer() {
            const mapLayers = _.values(this.map._layers);
            const featureLayers = _.filter(mapLayers, l => l.type === 'Feature Layer');
            _.each(featureLayers, (mapLayer) => {
                const geojson = this.createGeoJsonForFeature(mapLayer);
                // const sldXMLtext = this.createSldForFeature(mapLayer);
                const sldXMLtext = `
                    <sld:StyledLayerDescriptor version="1.0.0"
                xsi:schemaLocation="http://www.opengis.net/sldStyledLayerDescriptor.xsd"
                xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    >
                    <sld:NamedLayer>
                <Name>BetaAssets - Utility Structures</Name>
                <sld:UserStyle>
                <Title>BetaAssets_8551</Title>
                <FeatureTypeStyle>
                <Rule>
                <PointSymbolizer>
                <Graphic>
                <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                <CssParameter name="fill">#ff0000</CssParameter>
                    </Fill>
                    <Stroke>
                    <CssParameter name="stroke">#000000</CssParameter>
                    <CssParameter name="stroke-width">1.3333333333333333</CssParameter>
                    </Stroke>
                    </Mark>
                    <Size>12</Size>
                    </Graphic>
                    </PointSymbolizer>
                    </Rule>

                    </FeatureTypeStyle>
                    </sld:UserStyle>
                    </sld:NamedLayer>
                    </sld:StyledLayerDescriptor>
                        `;
                if (!mapLayer.name.includes('Utility')) {
                    return;
                }

                // console.log('config', this.config);
                console.log('addOverlay', mapLayer.name, {
                    geojson: JSON.stringify(geojson),
                    sldXMLtext,
                });
                // console.log('this.api', this.api);
                // console.log('viewerSRS', this.config.srs);
                this.api.addOverlay({
                    // sourceSrs: 'EPSG:3857',
                    name: mapLayer.name,
                    sldXMLtext,
                    geojson
                });
            });
        }

        createGeoJsonForFeature(mapLayer) {
            const arcgisFeatureSet = mapLayer.toJson().featureSet;
            const geojson = geoJsonUtils.arcgisToGeoJSON(arcgisFeatureSet);

            // Add the symbol prop to the geoJson so it is styled by the SLD
            // const newFeatures = geojson.features.map((feature) => this.getSymbolForFeature(feature, mapLayer));
            let wkid = _.get(arcgisFeatureSet, 'features[0].geometry.spatialReference.wkid', null);
            if (wkid) {
                wkid = wkid === 102100 ? 3857 : wkid;
                const crs = {
                    type: 'EPSG',
                    properties: {
                        code: wkid,
                    }
                };
                geojson.crs = crs;
            }
            return geojson;
        }

        getSymbolForFeature(feature, mapLayer) {
            debugger;
        }

        createSldForFeature(mapLayer) {
            let symbol;
            if (mapLayer.renderer && mapLayer.renderer.getSymbol && _.isFunction(mapLayer.renderer.getSymbol)) {
                symbol = mapLayer.renderer.getSymbol();
                // console.log('renderer symbol', symbol);
            } else if (mapLayer.renderer) {
                console.log('defaultSymbol', symbol);
                debugger;
                symbol = mapLayer.renderer.defaultSymbol;
            }

            if (!symbol) {
                console.log('own symbol', symbol);
                debugger;
                symbol = this.defaultSymbol;
            }

            let stroke = null;
            let strokeWidth = null;
            if (symbol.outline) {
                stroke = symbol.outline.color.toHex();
                strokeWidth = symbol.outline.width;
            }

            // todo: image parsing


            // fill, stroke, strokeWidth, shape, name, title, imageType, imageUrl, imageSize, lineWidth, polygonLength
            return sldStyling.applySldStyling({
                name: mapLayer.name,
                title: mapLayer.id,
                fill: symbol.color.toHex(),
                shape: symbol.style,
                imageType: null,
                imageUrl: null,
                imageSize: null,
                lineWidth: symbol.width,
                polygonLength: null,
                strokeWidth,
                stroke,
            });
        }

        _overlayFeatures() {
            let mapLayers = this.map._layers;
            let layerName;
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
                        overlaySrs: new SpatialReference({ wkid: mapLayer.spatialReference.wkid}),
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
            overlayParameters.mapLayer.graphics.forEach((pointFeature) => {
                const srsViewer = parseInt(this.config.srs.substr(5));
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
            console.log('displayLineFeatures', overlayParameters);
            const symbolLine = "line";
            const properties = {
                symbol: symbolLine
            };
            overlayParameters.mapLayer.graphics.forEach((pointFeature) => {
                let lineCoords = [];
                pointFeature.geometry.paths[0].forEach((featurePoint) => {
                    const mapPt = new Point(featurePoint[0], featurePoint[1], overlayParameters.overlaySrs);
                    const srsViewer = parseInt(this.config.srs.substr(5));
                    const ptViewer = utils.transformProj4js(mapPt, srsViewer);
                    const lineCoordinate = [ptViewer.x, ptViewer.y];
                    lineCoords.push(lineCoordinate);
                });

                let featureLineViewer = {
                    type: "Feature",
                    properties,
                    geometry: {
                        type: "LineString",
                        coordinates: lineCoords
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
            const symbolPoly = "polygon";
            overlayParameters.mapLayer.graphics.forEach((pointFeature) => {
                let polyCoords = [];
                const polyFeatureArray = pointFeature.geometry.rings[0];
                overlayParameters.polygonLength = polyFeatureArray.length;
                polyFeatureArray.forEach((featurePoint) => {
                    const mapPt = new Point(featurePoint[0], featurePoint[1], overlayParameters.overlaySrs);
                    const srsViewer = parseInt(this.config.srs.substr(5));
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
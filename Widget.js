let cmtDojoConfig = {
    async: true,
    locale: 'en',
    paths: {
        'react': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.min',
        'react-dom': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.min',
        'openlayers': 'https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol',
        'lodash': 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min'
    }
};

require(cmtDojoConfig, [], function () {
    return define([
        'dojo/_base/declare',
        'dojo/dom',
        'dojo/_base/lang',
        'dojo/on',
        'dojo/_base/array',
        'dojo/dom-style',
        'dojo/_base/Color',
        'dojo/dom-attr',
        'dijit/Tooltip',
        'esri/graphic',
        'esri/layers/FeatureLayer',
        'esri/layers/GraphicsLayer',
        'esri/geometry/Point',
        'esri/geometry/Polygon',
        'esri/geometry/ScreenPoint',
        'esri/SpatialReference',
        'esri/renderers/SimpleRenderer',
        'esri/symbols/PictureMarkerSymbol',
        'esri/symbols/SimpleMarkerSymbol',
        'esri/symbols/SimpleLineSymbol',
        'esri/symbols/SimpleFillSymbol',
        'esri/symbols/TextSymbol',
        'esri/geometry/Polyline',
        'esri/layers/LabelLayer',
        'esri/tasks/QueryTask',
        'esri/tasks/query',
        'esri/request',
        'jimu/BaseWidget',
        'https://streetsmart.cyclomedia.com/api/v18.1/StreetSmartApi.js',
        './js/utils',
        './js/sldStyling',
        'https://unpkg.com/shpjs@latest/dist/shp.js',
        'https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol.js'
    ], function (declare,
                 dom,
                 lang,
                 on,
                 dojoArray,
                 domStyle,
                 Color,
                 domAttr,
                 Tooltip,
                 Graphic,
                 FeatureLayer,
                 GraphicsLayer,
                 Point,
                 Polygon,
                 ScreenPoint,
                 SpatialReference,
                 SimpleRenderer,
                 PictureMarkerSymbol,
                 SimpleMarkerSymbol,
                 SimpleLineSymbol,
                 SimpleFillSymbol,
                 TextSymbol,
                 Polyline,
                 LabelLayer,
                 QueryTask,
                 Query,
                 esriRequest,
                 BaseWidget,
                 StreetSmartApi,
                 utils,
                 sldStyling,
                 Shp,
                 ol) {
        //To create a widget, you need to derive from BaseWidget.
        return declare([BaseWidget], {
            // Custom widget code goes here
            baseClass: 'jimu-widget-streetsmartwidget',

            // This property is set by the framework when widget is loaded.
            name: 'Street Smart by CycloMedia',

            // CM properties
            _recordingColor: '#005293',
            _cmtTitleColor: '#98C23C',
            _apiKey: 'C3oda7I1S_49-rgV63wtWbgtOXcVe3gJWPAVWnAZK3whi7UxCjMNWzIJyv4Fmrcp',
            _panoramaViewer: null,
            _recordingClient: null,
            _lyrRecordingPoints: null,
            _lyrCameraIcon: null,
            _measureLayer: null,
            _overlayLayer: null,
            _overlayId: null,
            _prePoint: null,

            _mapExtentChangeListener: null,

            // Methods to communication with app container:
            postCreate: function () {
                this.inherited(arguments);
                console.info('postCreate');

                this.measureChange = true;
                this.JsonLayerButton = false;
                this.streetSmartInitiated = true;
                this.arrayOverlayIds = {};
                this.lineOverlayIds = {};
                this.polyOverlayIds = {};


                // Set title color for Widget.
                // Via css (.jimu-on-screen-widget-panel>.jimu-panel-title) all widgets are affected.
                if (this.getPanel().titleNode) {
                    this.getPanel().titleNode.style.backgroundColor = this._cmtTitleColor;
                    this.getPanel().titleLabelNode.style.color = "white";
                }

                // Remove padding (white 'border') around viewer.
                // Via css (.jimu-widget-frame.jimu-container) all widgets are affected.
                this.getPanel().containerNode.children[0].style.padding = '0px';

                // Use the Street Smart API proj4. All projection definitions are in there already.
                utils.setProj4(CM.Proj4.getProj4());

                //set the Map zoom level to load the recordings.
                this.mapZoomLevel = this._checkMapZoomLevel();

                //set the viewer type for the widget.
                this.viewerType = StreetSmartApi.ViewerType.PANORAMA;

                //let srs = 'EPSG:' + this.map.spatialReference.wkid;

                let viewDiv = this.panoramaViewerDiv;

                if (this.config.agreement !== "accept") {
                    alert("Please accept the CycloMedia terms and agreements in the widget settings");
                } else {

                    let stsmInit = {
                        targetElement: viewDiv,
                        username: this.config.uName,
                        password: this.config.uPwd,
                        apiKey: this._apiKey,
                        srs: this.config.srs,
                        locale: this.config.locale,
                        configurationUrl: this.config.atlasHost + '/configuration',
                        addressSettings: {
                            locale: this.config.locale,
                            database: 'Nokia'
                        }
                    };

                    StreetSmartApi.init(stsmInit).then(function () {
                        console.info('Api init success');

                        this.initRecordingClient();

                        this.createLayers();

                        // onOpen will be called before api is initialized, so call this again.
                        this.onOpen();

                        //adding measurement events to the viewer
                        let msEvents = StreetSmartApi.Events.measurement;
                        StreetSmartApi.on(msEvents.MEASUREMENT_CHANGED, measurementEvent => this._handleMeasurements(measurementEvent));
                    }.bind(this))
                        .catch(function () {
                            console.log("API init Failed");
                            alert("Street Smart API initiation Failed");
                        });
                }
            },

            startup: function () {
                this.inherited(arguments);
                console.info('startup');
            },

            initRecordingClient: function () {
                console.info('initRecordingClient');

                let basicToken = btoa(this.config.uName + ":" + this.config.uPwd);
                let authHeader = {
                    "Authorization": "Basic " + basicToken
                };

                if (this.config.atlasHost) {
                    this._recordingClient = new CM.aperture.WfsRecordingClient({
                        uriManager: new CM.aperture.WfsRecordingUriManager({
                            apiKey: this._apiKey,
                            dataUri: this.config.atlasHost + "/recording/wfs",
                            withCredentials: true
                        }),
                        authHeaders: authHeader
                    });
                } else {
                    console.warn('No CycloMedia atlas host configured.');
                }
            },

            addEventListener: function (element, type, callback) {
                if (element && type && callback) {
                    return on(element, type, callback);
                } else {
                    console.warn('Invalid parameters');
                    return null;
                }
            },

            removeEventListener: function (listener) {
                if (listener && typeof listener.remove === 'function') {
                    listener.remove();
                    return null;
                }
            },

            _onExtentChanged: function () {
                if (this.map.getZoom() > this.mapZoomLevel && this.state !== "closed") {
                    this._loadRecordings();
                    if (this.config.overlay === true) {
                        this._displayFeatures();
                    }
                } else {
                    this._clearLayerGraphics(this._lyrRecordingPoints);
                    this._lyrCameraIcon.setVisibility(false);
                }
            },

            createLayers: function () {
                console.info('createLayers');
                let rgb = new Color.fromString(this._recordingColor).toRgb();
                rgb.push(0.5);
                this._recordingColor = Color.fromArray(rgb);

                let ms = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 255]), 1), new Color.fromArray(rgb));
                let ren = new SimpleRenderer(ms);

                let emptyFeatureCollection = {
                    "layerDefinition": {
                        "geometryType": "esriGeometryPoint",
                        "fields": [{
                            "name": "id",
                            "alias": "ID",
                            "type": "esriFieldTypeOID"
                        }]
                    },
                    "featureSet": null
                };

                //Read Feature Layers from the Map and display on the GeoCyclorama
                if (this.config.overlay === true) {
                    this._displayFeatures();
                }

                // RecordingLayer
                this._lyrRecordingPoints = new FeatureLayer(emptyFeatureCollection, {id: "cmt_recordings"});
                //this._lyrRecordingPoints.setVisibility(false);
                this._lyrRecordingPoints.setRenderer(ren);
                on(this._lyrRecordingPoints, "click", this._clickRecordingPoint.bind(this));
                this.map.addLayer(this._lyrRecordingPoints);

                //measurement layer
                let measureCollection = {
                    "layerDefinition": {
                        "geometryType": "esriGeometryPoint",
                        "fields": [{
                            "name": "id",
                            "alias": "ID",
                            "type": "esriFieldTypeOID"
                        }]
                    },
                    "featureSet": null
                };

                let measureSymbol = new SimpleMarkerSymbol();
                measureSymbol.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
                measureSymbol.setAngle(47);
                let measureRen = new SimpleRenderer(measureSymbol);

                this._measureLayer = new FeatureLayer(measureCollection, {id: "cmt_measure"});
                this._measureLayer.setRenderer(measureRen);
                this.map.addLayer(this._measureLayer);

                //Overlay layer
                this._overlayLayer = new GraphicsLayer({id: "cmt_overlay"});
                this.map.addLayer(this._overlayLayer);

                // CameraIcon Layer
                this._lyrCameraIcon = new GraphicsLayer({id: "cmt_cameraLayer"});
                this.map.addLayer(this._lyrCameraIcon);
                this.addEventListener(this._lyrCameraIcon, "mouse-down", () => {
                    this._viewerOrientation();
                });

            },

            _displayFeatures: function () {
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
            },

            _layerSymbology: function (
                {
                    layerName,
                    featurePoints,
                    featureLines,
                    featurePolys,
                    overlaySrs,
                    esriGeometryPointStr,
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
                let self = this;
                let sldName = mapLayer.name;
                let sldTitle = mapLayer.id;
                let fillColor;
                if(layerSymbology.color) {
                    try{
                        fillColor = layerSymbology.color.toHex();
                    }catch(err) {
                        let rgba = new Color.fromArray(layerSymbology.color);
                        fillColor = rgba.toHex();
                    }

                }
                let strokeColor, strokeWidth, imageType, imageUrl, imageSize, lineWidth, polygonLength;
                if (mapLayer.geometryType === esriGeometryPointStr) {
                    let symbolShape, pointStyling;
                    if (layerSymbology.type === markSymbol) {
                        if (layerSymbology.outline) {
                            let toCovert = layerSymbology.outline.color;
                            let arrayColor = "rgba(" +[toCovert.r, toCovert.g, toCovert.b, toCovert.a].toString() + ")";
                            strokeColor = this.rgbaToHex(arrayColor);
                            strokeWidth = layerSymbology.outline.width;
                            symbolShape = layerSymbology.style;
                        }
                    } else if (layerSymbology.type === imageSymbol || esriPictureSymbol) {
                        imageType = layerSymbology.contentType;
                        let imageDat = layerSymbology.imageData;
                        let imageLink = layerSymbology.url;
                        let imgDatValue = this._imageUrlValidation(imageDat);
                        if (imgDatValue === false) {
                            imageUrl = imageLink;
                            imageUrl = " ' " + imageUrl + " ' ";
                        } else {
                            imageUrl = imageDat;
                            imageUrl = " ' " + imageUrl + " ' ";
                        }
                        console.log(imgDatValue);
                        imageSize = layerSymbology.size;
                        symbolShape = "image";
                    }
                    //Here i read each point from the feature layer
                    dojoArray.forEach(mapLayer.graphics, function (pointFeature, i) {
                        let srsViewer = parseInt(self.config.srs.substr(5));
                        let ptViewer = utils.transformProj4js(pointFeature.geometry, srsViewer);
                        let ptCooridnate = [ptViewer.x, ptViewer.y];
                        const properties = {
                            symbol: symbolShape
                        };
                        let featurePtViewer = {
                            "type": "Feature",
                            properties,
                            "geometry": {
                                "type": "Point",
                                "coordinates": ptCooridnate
                            }
                        };
                        featurePoints.push(featurePtViewer);
                    });
                    //create a geojson here for the cyclorama
                    let featureGeoJSON = {
                        "type": "FeatureCollection",
                        "features": featurePoints
                    };
                    let overlayOptions;
                    if (symbolShape) {
                        pointStyling = sldStyling.sldStylingPoints(fillColor, strokeColor, strokeWidth, symbolShape, sldName, sldTitle, imageType, imageUrl, imageSize, lineWidth, polygonLength);
                        overlayOptions = {
                            name: layerName,
                            geojson: featureGeoJSON,
                            sourceSrs: self.config.srs,
                            sldXMLtext: pointStyling
                        };
                    } else {
                        overlayOptions = {
                            name: layerName,
                            geojson: featureGeoJSON,
                            sourceSrs: self.config.srs
                        };
                    }
                    if (this.arrayOverlayIds[sldName]) {
                        StreetSmartApi.removeOverlay(this.arrayOverlayIds[sldName]);
                    }

                    let overlay = StreetSmartApi.addOverlay(overlayOptions);
                    console.log(overlay);
                    self.arrayOverlayIds[sldName] = overlay.id;
                }
                else if (mapLayer.geometryType === esriPolyLineStr) {
                    let symbolLine = "line";
                    const properties = {
                        symbol: symbolLine
                    };
                    dojoArray.forEach(mapLayer.graphics, function (pointFeature, i) {
                        let lineCoords = [];
                        dojoArray.forEach(pointFeature.geometry.paths[0], function (featurePoint, i) {
                            let mapPt = new Point(featurePoint[0], featurePoint[1], overlaySrs);
                            let srsViewer = parseInt(self.config.srs.substr(5));
                            let ptViewer = utils.transformProj4js(mapPt, srsViewer);
                            let lineCooridnate = [ptViewer.x, ptViewer.y];
                            lineCoords.push(lineCooridnate);
                        });

                        let featureLineViewer = {
                            "type": "Feature",
                            properties,
                            "geometry": {
                                "type": "LineString",
                                "coordinates": lineCoords
                            }
                        };
                        featureLines.push(featureLineViewer);
                    });
                    let featureGeoJSON = {
                        "type": "FeatureCollection",
                        "features": featureLines
                    };

                    let overlayOptions, lineStyling;
                    if (layerSymbology.type === lineSymbol || esriLineSymbol) {
                        lineWidth = layerSymbology.width;
                        lineStyling = sldStyling.sldStylingPoints(fillColor, strokeColor, strokeWidth, symbolLine, sldName, sldTitle, imageType, imageUrl, imageSize, lineWidth, polygonLength);
                        console.log(symbolLine);
                        console.log(lineStyling);
                        overlayOptions = {
                            name: layerName,
                            geojson: featureGeoJSON,
                            sourceSrs: self.config.srs,
                            sldXMLtext: lineStyling
                        };
                    }
                    if (this.lineOverlayIds[sldName]) {
                        StreetSmartApi.removeOverlay(this.lineOverlayIds[sldName]);
                    }

                    let overlay = StreetSmartApi.addOverlay(overlayOptions);
                    console.log(overlay);
                    self.lineOverlayIds[sldName] = overlay.id;
                }
                else if (mapLayer.geometryType === esriGeometryPolygonStr) {
                    let symbolPoly = "polygon";
                    dojoArray.forEach(mapLayer.graphics, function (pointFeature, i) {
                        let polyCoords = [];
                        let polyFeatureArray = pointFeature.geometry.rings[0];
                        polygonLength = polyFeatureArray.length;
                        dojoArray.forEach(polyFeatureArray, function (featurePoint, i) {
                            let mapPt = new Point(featurePoint[0], featurePoint[1], overlaySrs);
                            let srsViewer = parseInt(self.config.srs.substr(5));
                            let ptViewer = utils.transformProj4js(mapPt, srsViewer);
                            let ptCooridnate = [ptViewer.x, ptViewer.y];
                            polyCoords.push(ptCooridnate);
                        });

                        const properties = {
                            symbol: symbolPoly,
                            polygonLength: polygonLength
                        };

                        let featurePolyViewer = {
                            "type": "Feature",
                            properties,
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [polyCoords]
                            }
                        };
                        featurePolys.push(featurePolyViewer);
                    });
                    let featureGeoJSON = {
                        "type": "FeatureCollection",
                        "features": featurePolys
                    };

                    let overlayOptions, polyStyling;
                    if (layerSymbology.type === polygonSymbol || esriPolySymbol) {
                        if (layerSymbology.outline) {
                            let outColor = layerSymbology.outline.color;
                            let colorArray = "rgba(" + [outColor.r, outColor.g, outColor.b, outColor.a].toString() + ")";
                            strokeColor = this.rgbaToHex(colorArray);
                            strokeWidth = layerSymbology.outline.width;
                        }
                        polyStyling = sldStyling.sldStylingPoints(fillColor, strokeColor, strokeWidth, symbolPoly, sldName, sldTitle, imageType, imageUrl, imageSize, lineWidth, polygonLength);
                        console.log(symbolPoly);
                        console.log(polyStyling);
                        overlayOptions = {
                            name: layerName,
                            geojson: featureGeoJSON,
                            sourceSrs: self.config.srs,
                            sldXMLtext: polyStyling
                        };
                    }
                    if (this.polyOverlayIds[sldName]) {
                        StreetSmartApi.removeOverlay(this.polyOverlayIds[sldName]);
                    }
                    let overlay = StreetSmartApi.addOverlay(overlayOptions);
                    console.log(overlay);
                    self.polyOverlayIds[sldName] = overlay.id;
                }

            },

            rgbaToHex: function(rgb) {
                rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
                return (rgb && rgb.length === 4) ? "#" +
                    ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
                    ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
                    ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
            },

            _imageUrlValidation: function (imageURL) {

                let urlRegExp = new RegExp("^http(s?)\:\/\/[0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*(:(0-9)*)*(\/?)([a-zA-Z0-9\-\.\?\,\'\/\\\+&amp;%\$#_]*)?$");
                return urlRegExp.test(imageURL);
            },

            _loadRecordings: function () {
                if (this.map.getZoom() > this.mapZoomLevel && this._recordingClient) {
                    let extent = this.map.extent;
                    this._recordingClient.requestWithinBBOX(
                        extent.xmin,
                        extent.ymin,
                        extent.xmax,
                        extent.ymax,
                        this.map.spatialReference.wkid
                    ).then((recordings) => {
                        this._onRecordingLoadSuccess(recordings);
                    }).catch((err) => {
                        console.warn('RecordingLayer.recordingClient. Error: ', err);
                    });
                }
            },

            _onRecordingLoadSuccess: function (recordings) {
                let graphics = [];
                for (let i = 0; i < recordings.length; ++i) {
                    let attributes = {"recording_id": recordings[i].id};
                    let geom = new Point(recordings[i].xyz[0], recordings[i].xyz[1], new SpatialReference({wkid: 102100}));
                    let symbol = null;
                    let graphic = Graphic(geom, symbol, attributes, null);
                    graphics.push(graphic);
                }
                // Clear graphics from layer
                this._clearLayerGraphics(this._lyrRecordingPoints);
                // Add the new graphics to the layer.
                this._addLayerGraphics(this._lyrRecordingPoints, graphics);
                this._lyrCameraIcon.setVisibility(true);
            },

            _clearLayerGraphics: function (layer) {
                if (layer.graphics.length > 0) {
                    layer.applyEdits(null, null, layer.graphics);
                }
            },

            _addLayerGraphics: function (layer, graphics) {
                if (layer && (graphics && graphics.length > 0)) {
                    layer.applyEdits(graphics, null, null);
                }
            },

            _clickRecordingPoint: function (event) {
                let ptId = event.graphic.attributes.recording_id;
                StreetSmartApi.open(ptId,
                    {
                        viewerType: this.viewerType,
                        srs: this.config.srs,
                    }).then(
                    function (result) {
                        if (result && result[0]) {
                            console.log('Opened a panorama viewer through API!', result[0]);
                        }
                    }
                ).catch(
                    function (reason) {
                        console.log('Error opening panorama viewer: ' + reason);
                    }
                );


            },

            onOpen: function () {

                if (this.streetSmartInitiated === true) {
                    console.info('onOpen');
                    let self = this;

                    // Add extent change listener
                    if (!this._mapExtentChangeListener) {
                        this._mapExtentChangeListener = this.addEventListener(this.map, 'extent-change', this._onExtentChanged.bind(this));
                    }
                    if (this.map.getZoom() > this.mapZoomLevel) {

                        domStyle.set("zoomWarningDiv", "display", "none");
                        // If no recording loaded previously then use map center to open one.
                        if (StreetSmartApi.getApiReadyState()) {
                            let pt = this.map.extent.getCenter();
                            let mapSRS = this.config.srs;
                            let usableSRS = mapSRS.split(":");
                            let ptLocal = utils.transformProj4js(pt, usableSRS[1]);


                            StreetSmartApi.open(ptLocal.x + ',' + ptLocal.y,
                                {
                                    viewerType: this.viewerType,
                                    srs: mapSRS,
                                }).then(
                                function (result) {
                                    console.log('Created component through API:', result);
                                    if (result) {
                                        for (let i = 0; i < result.length; i++) {
                                            if (result[i].getType() === StreetSmartApi.ViewerType.PANORAMA) window.panoramaViewer = result[i];
                                        }
                                        this._panoramaViewer = window.panoramaViewer;
                                        this._addEventsToViewer();
                                        this._updateViewerGraphics(this._panoramaViewer, false);
                                        if (this.config.measurement !== true) {
                                            let measureBtn = StreetSmartApi.PanoramaViewerUi.buttons.MEASURE;
                                            this._panoramaViewer.toggleButtonEnabled(measureBtn);
                                        }
                                    }
                                }.bind(this)
                            ).catch(
                                function (reason) {
                                    console.log('Failed to create component(s) through API: ' + reason);
                                }
                            );
                        }
                        this._loadRecordings();

                    } else {
                        let showWarning = true;

                        if (this._panoramaViewer && this._panoramaViewer.getRecording() !== null) {
                            showWarning = false;
                        }

                        if (showWarning) {
                            domStyle.set("zoomWarningDiv", "display", "block");
                        }
                    }
                } else {
                    this.postCreate();
                }
            },

            _overlayButtonAdd: function () {
                const navbar = document.querySelector('.panoramaviewer .navbar');
                const nav = navbar.querySelector('.navbar-right .nav');
                let self = this;
                let btn = nav.querySelector('.btn');
                if (!nav.querySelector('#addGeoJsonBtn')) {
                    let addJsonBtn = dojo.create("button", {
                        id: "addGeoJsonBtn",
                        class: btn.className,
                        onclick: function () {
                            self._jsonOverlay()
                        }
                    });
                    let uploadJson = dojo.create("input", {id: "uploadJsonBtn", type: "file"});
                    nav.appendChild(addJsonBtn);
                    nav.appendChild(uploadJson);
                    let btnJsonTip = dom.byId('addGeoJsonBtn');
                    let toolTipMsg = "Add a SHP or GeoJSON overlay";
                    new Tooltip({
                        connectId: btnJsonTip,
                        label: toolTipMsg,
                        position: ["above"]
                    });
                    self.JsonLayerButton = true;
                }
            },

            onClose: function () {
                console.info('onClose');

                let divView = this.panoramaViewerDiv;

                // Remove extent change listener.
                this._mapExtentChangeListener = this.removeEventListener(this._mapExtentChangeListener);

                StreetSmartApi.destroy({targetElement: divView});

                // Remove Graphics from layers.
                this._clearLayerGraphics(this._lyrRecordingPoints);
                this._lyrCameraIcon.setVisibility(false);
                this.streetSmartInitiated = false;
                this.map.removeLayer(this._measureLayer);
                this.map.removeLayer(this._lyrRecordingPoints);
                this.map.removeLayer(this._lyrCameraIcon);
                this._recordingColor = this._recordingColor.toHex();

            },

            _addEventsToViewer: function () {

                this.addEventListener(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, () => {
                    this._updateViewerGraphics(this._panoramaViewer, false);
                });
                this.addEventListener(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, () => {
                    this._updateViewerGraphics(this._panoramaViewer, false);
                });
                const navBar = document.getElementsByClassName('.navbar-menu');
                //navBar.addEventListener("click", this._overlayButtonAdd());

            },

            _jsonOverlay: function () {
                let self = this;
                if (self.JsonLayerButton === true) {
                    let btnUpload = dom.byId("uploadJsonBtn");
                    btnUpload.click();
                    dojo.connect(btnUpload, "change", function () {
                        let fileData = btnUpload.files[0];
                        console.log(fileData);
                        if (fileData.type === "application/zip") {
                            let reader = new FileReader();
                            reader.onload = function (e) {
                                console.log(reader.result);
                                Shp(reader.result).then(function (geoJson) {
                                    console.log(geoJson);
                                    let overlayPoints = [];
                                    let overlayGraphics = [];
                                    let responsePoints;
                                    let panoGeoJSON;
                                    if (geoJson.features[0].geometry.type === "LineString" || geoJson.features[0].geometry.type === "Polygon" && geoJson.features[0].geometry.coordinates[0].length < 3) {
                                        responsePoints = geoJson.features[0].geometry.coordinates;
                                        panoGeoJSON = geoJson;
                                        dojoArray.forEach(responsePoints, function (respPoint, i) {
                                            let ptX = respPoint[0];
                                            let ptY = respPoint[1];
                                            //points for overlay on the map
                                            let mapPt = new Point(ptX, ptY, new SpatialReference({wkid: 102100}));
                                            let polyPoint = [mapPt.x, mapPt.y];
                                            let pts = new Point(ptX, ptY, new SpatialReference({wkid: 4326}));
                                            overlayGraphics.push(polyPoint);
                                        });

                                        if (geoJson.features[0].geometry.type === "LineString") {
                                            let lineJson = {
                                                "paths": [overlayGraphics],
                                                "spatialReference": {"wkid": 4326}
                                            };
                                            let line = new Polyline(lineJson);
                                            let polyFs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                                                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                                    new Color([152, 194, 60]), 2),
                                                new Color([152, 194, 60, 0.2])
                                            );
                                            //let polyGraphic = new Graphic(poly, fs);
                                            self._overlayLayer.add(new Graphic(line, polyFs));

                                        }
                                        if (geoJson.features[0].geometry.type === "Polygon") {
                                            let polygonJson = {
                                                "rings": [overlayGraphics],
                                                "spatialReference": {"wkid": 4326}
                                            };
                                            let poly = new Polygon(polygonJson);
                                            let polyFs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                                                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                                    new Color([152, 194, 60]), 2),
                                                new Color([152, 194, 60, 0.2])
                                            );
                                            //let polyGraphic = new Graphic(poly, fs);
                                            self._overlayLayer.add(new Graphic(poly, polyFs));

                                        }
                                    } else {
                                        responsePoints = geoJson.features[0].geometry.coordinates[0];

                                        dojoArray.forEach(responsePoints, function (respPoint, i) {
                                            let ptX = respPoint[0];
                                            let ptY = respPoint[1];
                                            //points for overlay on the map
                                            let mapPt = new Point(ptX, ptY, new SpatialReference({wkid: 102100}));
                                            let polyPoint = [mapPt.x, mapPt.y];
                                            let pts = new Point(ptX, ptY, new SpatialReference({wkid: 4326}));
                                            overlayGraphics.push(polyPoint);

                                            //points for overlay on the GeoCylorama
                                            let srsParam = parseInt(self.config.srs.substr(5));
                                            let ptPano = utils.transformProj4js(pts, srsParam);
                                            let pointOverlay = [ptPano.x, ptPano.y];
                                            overlayPoints.push(pointOverlay);
                                        });

                                        //show the overlay on the map
                                        let polygonJson = {
                                            "rings": [overlayGraphics],
                                            "spatialReference": {"wkid": 4326}
                                        };
                                        let poly = new Polygon(polygonJson);
                                        let polyFs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                                            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                                new Color([152, 194, 60]), 2),
                                            new Color([152, 194, 60, 0.2])
                                        );
                                        //let polyGraphic = new Graphic(poly, fs);
                                        self._overlayLayer.add(new Graphic(poly, polyFs));

                                        //show overlay on the GeoCyclorama
                                        panoGeoJSON = {
                                            "type": "FeatureCollection",
                                            "features": [
                                                {
                                                    "type": "Feature",
                                                    "properties": {},
                                                    "geometry": {
                                                        "type": geoJson.features[0].geometry.type,
                                                        "coordinates": [overlayPoints]
                                                    }
                                                }
                                            ]
                                        };
                                    }
                                    StreetSmartApi.addOverlay(geoJson.fileName, panoGeoJSON, self.config.srs);
                                });
                            };
                            reader.readAsArrayBuffer(fileData);
                        } else {
                            let reader = new FileReader();
                            reader.onload = function (e) {
                                let res = reader.result;
                                let finalJson = JSON.parse(res);
                                StreetSmartApi.addOverlay('New GeoJSON', finalJson, self.config.srs);

                            };
                            reader.readAsText(fileData);
                        }
                    });
                }
            },

            _handleMeasurements: function (measurementEvent) {
                let self = this;
                console.log(this);
                if (measurementEvent && measurementEvent.detail) {
                    const {activeMeasurement, panoramaViewer} = measurementEvent.detail;
                    if (activeMeasurement) {
                        if (panoramaViewer && self.measureChange === true) {
                            self._lyrCameraIcon.clear();
                            self.addEventListener(panoramaViewer, StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, () => {
                                self._updateViewerGraphics(panoramaViewer, false);
                            });
                            self.addEventListener(panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, () => {
                                self._updateViewerGraphics(panoramaViewer, false);
                            });
                            self.measureChange = false;
                        }
                        if (activeMeasurement.features[0].geometry.type === "Point" || activeMeasurement.features[0].geometry.type === "LineString") {
                            let measurmentCoordinates;
                            let coordinatesLength;
                            if (activeMeasurement.features[0].geometry.type !== "Point") {
                                measurmentCoordinates = activeMeasurement.features[0].geometry.coordinates;
                                coordinatesLength = measurmentCoordinates.length;
                            } else if (activeMeasurement.features[0].geometry.type !== "LineString") {
                                if (activeMeasurement.features[0].geometry.coordinates !== null) {
                                    measurmentCoordinates = [activeMeasurement.features[0].geometry.coordinates];
                                }
                            }
                            let measureLinePoints = [];
                            dojoArray.forEach(measurmentCoordinates, function (coordMeasure, i) {
                                let pointX = coordMeasure[0];
                                let pointY = coordMeasure[1];
                                let pt = new Point(pointX, pointY, new SpatialReference({wkid: parseInt(self.config.srs.substr(5))}));
                                let ptMap = utils.transformProj4js(pt, self.map.spatialReference.wkid);
                                let measureGraphics = [];
                                let geom = new Point(ptMap.x, ptMap.y, new SpatialReference({wkid: 102100}));
                                let symbol = null;
                                let measureNumber = new TextSymbol();
                                measureNumber.setText(i + 1);
                                measureNumber.setVerticalAlignment("top");
                                measureNumber.setHorizontalAlignment("right");
                                let measureGraphic = Graphic(geom, symbol, null);
                                measureGraphics.push(measureGraphic);
                                self._addLayerGraphics(self._measureLayer, measureGraphics);
                                self.map.graphics.add(new Graphic(geom, measureNumber));
                                if (coordinatesLength > 1) {
                                    let linePoints = [ptMap.x, ptMap.y];
                                    measureLinePoints.push(linePoints);
                                }
                            });
                            if (coordinatesLength > 1) {
                                console.log("measurepoints" + measureLinePoints);
                                let polyJson = {
                                    "paths": [measureLinePoints],
                                    "spatialReference": {wkid: 102100},
                                };
                                let measureLines = new Polyline(polyJson);
                                let symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([26, 26, 26, 1]), 2);
                                self.map.graphics.add(new Graphic(measureLines, symbol));
                                let x1 = (measureLinePoints[coordinatesLength - 2][0] + measureLinePoints[coordinatesLength - 1][0]) / 2;
                                let y1 = (measureLinePoints[coordinatesLength - 2][1] + measureLinePoints[coordinatesLength - 1][1]) / 2;
                                let lineLabelPoint = new Point(x1, y1, new SpatialReference({wkid: 102100}));
                                let value = parseFloat(activeMeasurement.features[0].properties.derivedData.totalLength.value).toFixed(2) + activeMeasurement.features[0].properties.derivedData.unit;
                                let measureValue = new TextSymbol(value);
                                measureValue.setVerticalAlignment("middle");
                                measureValue.setHorizontalAlignment("right");
                                self.map.graphics.add(new Graphic(lineLabelPoint, measureValue));
                            }
                        }
                        if (activeMeasurement.features[0].geometry.type === "Polygon") {
                            //console.log(activeMeasurement.features[0].geometry.coordinates);
                            let surfacePoints = [];
                            let surfaceMeasurePoints = activeMeasurement.features[0].geometry.coordinates[0];
                            let surfaceMeasureLength = surfaceMeasurePoints.length;
                            if (surfaceMeasureLength > 0) {
                                for (let i = 1; i < surfaceMeasureLength; i++) {
                                    let surfaceX = surfaceMeasurePoints[i][0];
                                    let surfaceY = surfaceMeasurePoints[i][1];
                                    let surfacePt = new Point(surfaceX, surfaceY, new SpatialReference({wkid: parseInt(self.config.srs.substr(5))}));
                                    let surfacePtMap = utils.transformProj4js(surfacePt, self.map.spatialReference.wkid);
                                    let surfaceGraphics = [];
                                    let surfaceGeom = new Point(surfacePtMap.x, surfacePtMap.y, new SpatialReference({wkid: 102100}));
                                    let surfaceSymbol = null;
                                    let surfaceMeasureNumber = new TextSymbol();
                                    surfaceMeasureNumber.setText(i);
                                    surfaceMeasureNumber.setVerticalAlignment("top");
                                    surfaceMeasureNumber.setHorizontalAlignment("right");
                                    let surfaceMeasureGraphic = Graphic(surfaceGeom, surfaceSymbol, null);
                                    surfaceGraphics.push(surfaceMeasureGraphic);
                                    self._addLayerGraphics(self._measureLayer, surfaceGraphics);
                                    self.map.graphics.add(new Graphic(surfaceGeom, surfaceMeasureNumber));
                                    if (surfaceMeasureLength > 1) {
                                        let polyPoints = [surfacePtMap.x, surfacePtMap.y];
                                        surfacePoints.push(polyPoints);
                                    }
                                }
                                if (surfaceMeasureLength > 2) {
                                    console.log("measurepoints" + surfacePoints);
                                    let polyJson = {
                                        "rings": [surfacePoints],
                                        "spatialReference": {wkid: 102100}
                                    };
                                    let surfaceMeasureLines = new Polygon(polyJson);
                                    let polySymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([26, 26, 26, 1]), 2);
                                    self.map.graphics.add(new Graphic(surfaceMeasureLines, polySymbol));
                                    let x1 = (surfacePoints[surfaceMeasureLength - 3][0] + surfacePoints[surfaceMeasureLength - 2][0]) / 2;
                                    let y1 = (surfacePoints[surfaceMeasureLength - 3][1] + surfacePoints[surfaceMeasureLength - 2][1]) / 2;
                                    let lineLabelPoint = new Point(x1, y1, new SpatialReference({wkid: 102100}));
                                    let value = parseFloat(activeMeasurement.features[0].properties.derivedData.segmentLengths.value[surfaceMeasureLength - 3]).toFixed(2) + activeMeasurement.features[0].properties.derivedData.unit;
                                    let measureValue = new TextSymbol(value);
                                    measureValue.setVerticalAlignment("middle");
                                    measureValue.setHorizontalAlignment("right");
                                    self.map.graphics.add(new Graphic(lineLabelPoint, measureValue));
                                }
                            }
                        }
                    } else if (!activeMeasurement) {
                        self._clearLayerGraphics(self._measureLayer);
                        self.map.graphics.clear();
                        self._lyrCameraIcon.clear();
                        self.measureChange = true;
                        self.addEventListener(panoramaViewer, StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, () => {
                            self._updateViewerGraphics(panoramaViewer, false);
                        });
                        self.addEventListener(panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, () => {
                            self._updateViewerGraphics(panoramaViewer, false);
                        });
                        const nav = document.querySelector('.panoramaviewer .navbar .nav');
                        if (nav !== null) {
                            self._overlayButtonAdd(nav);
                            document.addEventListener('click', () => {
                                setTimeout(() => {
                                    const expanded = document.querySelector('.panoramaviewer .viewer-navbar-expanded');
                                    if (expanded) {
                                        this._overlayButtonAdd();
                                    }
                                }, 250);
                            }, true);
                        }
                    }
                }

            },

            _updateViewerGraphics: function (currentViewer, extentchanged) {

                let curViewer = currentViewer._viewer;
                if (!curViewer._activeRecording) return;

                let x = curViewer._activeRecording.xyz[0];
                let y = curViewer._activeRecording.xyz[1];
                if (x && y) {
                    let pt = new Point(x, y, new SpatialReference({wkid: parseInt(curViewer._activeRecording.srs.substr(5))}));
                    //Transform local SRS to Web Mercator:
                    let ptMap = utils.transformProj4js(pt, this.map.spatialReference.wkid);

                    let yaw = curViewer.getYaw();
                    let pitch = curViewer.getPitch();
                    let hFov = curViewer.getHFov();

                    let factor = 50;
                    let hhFov = hFov * 0.5;
                    let leftfovx = Math.sin(yaw - hhFov) * factor;
                    let leftfovy = -Math.cos(yaw - hhFov) * factor;
                    let rightfovx = Math.sin(yaw + hhFov) * factor;
                    let rightfovy = -Math.cos(yaw + hhFov) * factor;

                    let mapPt = new Point(ptMap.x, ptMap.y, this.map.spatialReference);
                    let cPt = this.map.toScreen(mapPt);
                    this._prePoint = mapPt;

                    let a = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));
                    let b = this.map.toMap(new ScreenPoint(cPt.x + leftfovx, cPt.y + leftfovy));
                    let c = this.map.toMap(new ScreenPoint(cPt.x + rightfovx, cPt.y + rightfovy));
                    let d = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));

                    if (!curViewer.graLoc) {
                        let folderPath = this.folderUrl + "images/cam1.png";
                        let ms = new PictureMarkerSymbol(folderPath, 28, 28);
                        let marker = new Graphic(mapPt, ms);
                        curViewer.graLoc = marker;
                        this._lyrCameraIcon.add(marker);
                    } else {
                        curViewer.graLoc.setGeometry(mapPt);
                    }
                    let rot = yaw * 180 / Math.PI;
                    curViewer.graLoc.symbol.setAngle(rot);

                    if (curViewer.graFOV) {
                        this._lyrCameraIcon.remove(curViewer.graFOV);
                    }
                    let ls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 1), 2);
                    let rgba = currentViewer.getViewerColor();
                    rgba[3] = 0.5; // set alpha
                    let fs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, ls, new Color.fromArray(rgba));
                    let polygon = new Polygon(this.map.spatialReference);
                    polygon.addRing([[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y], [a.x, a.y]]);
                    let graphic = new Graphic(polygon, fs);
                    curViewer.graFOV = graphic;
                    this._lyrCameraIcon.add(graphic);
                    this._lyrCameraIcon.setVisibility(true);
                }
            },

            _viewerOrientation: function () {

                this.map.disablePan();
                this.coneDrag = on(this.map, 'mouse-drag', event => {
                    this._coneMoved(event);
                });
                this.coneDragEnd = on(this.map, 'mouse-drag-end', () => {
                    this._coneReleased();
                });

            },

            _coneMoved: function (event) {

                let mapPt = event.mapPoint;
                let orientation = this._panoramaViewer.getOrientation();
                let currentPitch = orientation.pitch;
                let currentHFov = orientation.hFov;
                let angle = this._calcYaw(this._prePoint, mapPt);
                let rotAngle = angle * 180 / Math.PI;
                let orientationObj = {
                    yaw: rotAngle,
                    pitch: currentPitch,
                    hFov: currentHFov
                };
                this._panoramaViewer.setOrientation(orientationObj);
            },

            _coneReleased: function () {

                this.map.enablePan();
                this.coneDrag.remove();
                this.coneDragEnd.remove();
            },

            _calcYaw: function (pt1, pt2) {
                let yDiff = pt2.y - pt1.y;
                let xDiff = pt2.x - pt1.x;
                let angle = Math.atan2(yDiff, xDiff) * 180 / Math.PI;
                let a = angle;
                if (angle > 0 && angle <= 90)
                    a = 90 - angle;
                if (angle > 90 && angle <= 180)
                    a = 360 - angle + 90;
                if (angle < 0)
                    a = 90 - angle;
                let rad = a * Math.PI / 180;
                return rad;
            },

            _checkMapZoomLevel: function () {
                let mapMaxZoom = this.map.getMaxZoom();
                let setMapZoom;
                if (mapMaxZoom > 20) {
                    setMapZoom = mapMaxZoom - 5;
                } else {
                    setMapZoom = mapMaxZoom - 3;
                }
                return setMapZoom;
            },

            onMinimize: function () {
                console.log('onMinimize');
            },

            // onMaximize: function(){
            //   console.log('onMaximize');
            // },

            // onSignIn: function(credential){
            //   /* jshint unused:false*/
            //   console.log('onSignIn');
            // },

            // onSignOut: function(){
            //   console.log('onSignOut');
            // }

            // onPositionChange: function(){
            //   console.log('onPositionChange');
            // },

            resize: function () {
                console.info('resize');
                // TODO NOT an official api function. will be in the next api release (v16.1+)!
                // recalculate size for panoramaviewer when widget resizes.
                this._panoramaViewer._viewer.invalidateSize();
            }

            //methods to communication between widgets:

        });
    });
});
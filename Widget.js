var dojoConfig = {
    async: true,
    locale: 'en',
    paths: {
        'react': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.3.0/react.min',
        'react-dom': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.3.0/react-dom.min',
        'openlayers': 'https://cdnjs.cloudflare.com/ajax/libs/ol3/3.17.1/ol',
    }
};

require(dojoConfig, [], function() {
    return define([
        'dojo/_base/declare',
        'dojo/dom',
        'dojo/_base/lang',
        'dojo/on',
        'dojo/dom-style',
        'dojo/_base/Color',
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
        'jimu/BaseWidget',
        'https://streetsmart.cyclomedia.com/api/v16.1/Aperture.js',
        'https://streetsmart.cyclomedia.com/api/v16.1/StreetSmartApi.js',
        './js/utils'
        ], function (
            declare,
            dom,
            lang,
            on,
            domStyle,
            Color,
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
            BaseWidget,
            Aperture,
            StreetSmartApi,
            utils
        ) {
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

                _mapExtentChangeListener: null,

                // Methods to communication with app container:
                postCreate: function() {
                    this.inherited(arguments);
                    console.info('postCreate');

                    // Set title color for Widget.
                    // Via css (.jimu-on-screen-widget-panel>.jimu-panel-title) all widgets are affected.
                    this.getPanel().titleNode.style.backgroundColor = this._cmtTitleColor;

                    // Remove padding (white 'border') around viewer.
                    // Via css (.jimu-widget-frame.jimu-container) all widgets are affected.
                    this.getPanel().containerNode.children[0].style.padding = '0px';

                    // Use the Street Smart API proj4. All projection definitions are in there already.
                    utils.setProj4(CM.Proj4.getProj4());

                    //set the Map zoom level to load the recordings.
                    this.mapZoomLevel = this._checkMapZoomLevel();

                    var me = this;
                    var srs = 'EPSG:' + me.map.spatialReference.wkid;

                    if(this.config.agreement !== "accept"){
                        alert("Please accept the CycloMedia terms and agreements in the widget settings");
                    }else {
                        StreetSmartApi.init({
                            username: this.config.uName,
                            password: this.config.uPwd,
                            apiKey: this._apiKey,
                            srs: srs,
                            locale: this.config.locale,
                            addressSettings: {
                                locale: this.config.locale,
                                database: 'CMDatabase'
                            }
                        }).then(function () {
                            console.info('Api init success');

                            this._panoramaViewer = StreetSmartApi.addPanoramaViewer(me.panoramaViewerDiv, {
                                recordingsVisible: true,
                                timeTravelVisible: true
                            });


                            me.addEventListener(me._panoramaViewer._viewer, 'viewchange', function () {
                                me._updateViewerGraphics(this, false);
                            });
                            me.addEventListener(me._panoramaViewer._viewer, 'panoromachange', function () {
                                me._updateViewerGraphics(this, false);
                            });

                            this.initRecordingClient();

                            this.createLayers();

                            // onOpen will be called before api is initialized, so call this again.
                            this.onOpen();

                        }.bind(this))
                            .catch(function () {
                                console.log("API init Failed");
                                alert("Street Smart API initiation Failed");
                            });
                    }
                },

                startup: function() {
                    this.inherited(arguments);
                    console.info('startup');
                },

                initRecordingClient: function() {
                    console.info('initRecordingClient');
                    var basicToken = btoa(this.config.uName + ":" + this.config.uPwd);
                    var authHeader = {
                        "Authorization": "Basic " + basicToken
                    };

                    if(this.config.atlasHost) {
                        this._recordingClient = new CM.aperture.WfsRecordingClient({
                            uriManager: new CM.aperture.WfsRecordingUriManager({
                                apiKey: this._apiKey,
                                dataUri: this.config.atlasHost + "/recording/wfs",
                                withCredentials: true
                            }),
                            // TODO Will change to authHeaders in future
                            authHeader: authHeader
                        });
                    } else {
                        console.warn('No CycloMedia atlas host configured.');
                    }
                },

                addEventListener: function(element, type, callback) {
                    if(element && type && callback) {
                        return on(element, type, callback);
                    } else {
                        console.warn('Invalid parameters');
                        return null;
                    }
                },

                removeEventListener: function(listener) {
                    if(listener && typeof listener.remove === 'function') {
                        listener.remove();
                        return null;
                    }
                },

                _onExtentChanged: function() {
                    if (this.map.getZoom() > this.mapZoomLevel && this.state !== "closed") {
                        this._loadRecordings();
                        this.onOpen();
                    } else {
                        this._clearLayerGraphics(this._lyrRecordingPoints);
                        this._lyrCameraIcon.setVisibility(false);
                    }
                },

                createLayers: function() {
                    console.info('createLayers');
                    var rgb = new Color.fromString(this._recordingColor).toRgb();
                    rgb.push(0.5);
                    this._recordingColor = Color.fromArray(rgb);

                    var ms = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 255]), 1), new Color.fromArray(rgb));
                    var ren = new SimpleRenderer(ms);

                    var emptyFeatureCollection = {
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

                    // RecordingLayer
                    this._lyrRecordingPoints = new FeatureLayer(emptyFeatureCollection, { id: "cmt_recordings" });
                    //this._lyrRecordingPoints.setVisibility(false);
                    this._lyrRecordingPoints.setRenderer(ren);
                    on(this._lyrRecordingPoints, "click", this._clickRecordingPoint.bind(this));
                    this.map.addLayer(this._lyrRecordingPoints);

                    // CameraIcon Layer
                    this._lyrCameraIcon = new GraphicsLayer();
                    this.map.addLayer(this._lyrCameraIcon);
                },

                _loadRecordings: function() {
                    if (this.map.getZoom() > this.mapZoomLevel && this._recordingClient) {
                        var extent = this.map.extent;
                        this._recordingClient.requestWithinBBOX(
                            extent.xmin,
                            extent.ymin,
                            extent.xmax,
                            extent.ymax,
                            this.map.spatialReference.wkid
                        ).then(
                            this._onRecordingLoadSuccess.bind(this)
                        );
                    }
                },

                _onRecordingLoadSuccess: function(recordings) {
                    // TODO: remove custom symbol code (HD Cyclorama test stuff)
                    var makeSymbol = function(fillColor) {
                        return new SimpleMarkerSymbol(
                            SimpleMarkerSymbol.STYLE_CIRCLE, 9,
                            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, [255, 255, 255], 1),
                            fillColor
                        );
                    };
                    var symbolMapping = {
                        Dcr9Tiling: makeSymbol([100, 100, 255, 0.8]),
                        Dcr10Tiling: makeSymbol([100, 255, 100, 0.8]),
                        NoTiling: makeSymbol([200, 100, 150, 0.8])
                    };

                    var graphics = [];
                    for (var i = 0; i < recordings.length; ++i) {
                        var attributes = { "recording_id": recordings[i].id };
                        var geom = new Point(recordings[i].xyz[0], recordings[i].xyz[1], new SpatialReference({ wkid: 102100 }));
                        var symbol = null;
                        var tileSchema = recordings[i].tileSchema;
                        // symbol = tileSchema in symbolMapping ? symbolMapping[tileSchema] : null;
                        var graphic = Graphic(geom, symbol, attributes, null);
                        graphics.push(graphic);
                    }
                    // Clear graphics from layer
                    this._clearLayerGraphics(this._lyrRecordingPoints);
                    // Add the new graphics to the layer.
                    this._addLayerGraphics(this._lyrRecordingPoints, graphics);
                    this._lyrCameraIcon.setVisibility(true);
                },

                _clearLayerGraphics: function(layer) {
                    if (layer.graphics.length > 0) {
                        layer.applyEdits(null, null, layer.graphics);
                    }
                },

                _addLayerGraphics: function(layer, graphics) {
                    if (layer && (graphics && graphics.length > 0) ) {
                        layer.applyEdits(graphics, null, null);
                    }
                },

                _clickRecordingPoint: function(event) {
                    var ptId = event.graphic.attributes.recording_id;
                    this._panoramaViewer.openByImageId(ptId);
                },

                onOpen: function(){
                    console.info('onOpen');

                    // Add extent change listener
                    if(!this._mapExtentChangeListener) {
                        this._mapExtentChangeListener = this.addEventListener(this.map, 'extent-change', this._onExtentChanged.bind(this));
                    }

                    if (this.map.getZoom() > this.mapZoomLevel) {

                        domStyle.set("zoomWarningDiv", "display", "none");
                        // If no recording loaded previously then use mapcenter to open one.
                        if (StreetSmartApi.getAPIReadyState() && !this._panoramaViewer.getRecording()) {
                            var pt = this.map.extent.getCenter();
                            var mapSRS = this.map.spatialReference.wkid;
                            var ptLocal = utils.transformProj4js(pt, mapSRS);

                            this._panoramaViewer.openByCoordinate([ptLocal.x, ptLocal.y]);
                        }
                        this._loadRecordings();
                    } else {
                        var showWarning = true;

                        if (this._panoramaViewer && this._panoramaViewer.getRecording() !== null) {
                            showWarning = false;
                        }

                        if ( showWarning ) {
                            domStyle.set("zoomWarningDiv", "display", "block");
                        }
                    }
                },

                onClose: function(){
                  console.info('onClose');

                    // Remove extent change listener.
                    this._mapExtentChangeListener = this.removeEventListener(this._mapExtentChangeListener);

                    // Remove Graphics from layers.
                    if(this.map.getZoom() < this.mapZoomLevel){
                        this._clearLayerGraphics(this._lyrRecordingPoints);
                        this._lyrCameraIcon.setVisibility(false);
                    }

                },

                _updateViewerGraphics: function(curViewer, extentchanged) {

                    if (!curViewer._activeRecording) return;

                    var x = curViewer._activeRecording.xyz[0];
                    var y = curViewer._activeRecording.xyz[1];
                    if (x && y) {
                        var pt = new Point(x, y, new SpatialReference({ wkid: parseInt(curViewer._activeRecording.srs.substr(5)) }));
                        //Transform local SRS to Web Mercator:
                        var ptMap = utils.transformProj4js(pt, this.map.spatialReference.wkid);

                        var yaw = curViewer.getYaw();
                        var pitch = curViewer.getPitch();
                        var hFov = curViewer.getHFov();

                        var factor = 50;
                        var hhFov = hFov * 0.5;
                        var leftfovx = Math.sin(yaw - hhFov) * factor;
                        var leftfovy = -Math.cos(yaw - hhFov) * factor;
                        var rightfovx = Math.sin(yaw + hhFov) * factor;
                        var rightfovy = -Math.cos(yaw + hhFov) * factor;

                        var mapPt = new Point(ptMap.x, ptMap.y, this.map.spatialReference);
                        var cPt = this.map.toScreen(mapPt);

                        var a = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));
                        var b = this.map.toMap(new ScreenPoint(cPt.x + leftfovx, cPt.y + leftfovy));
                        var c = this.map.toMap(new ScreenPoint(cPt.x + rightfovx, cPt.y + rightfovy));
                        var d = this.map.toMap(new ScreenPoint(cPt.x, cPt.y));

                        if (!curViewer.graLoc) {
                            var folderPath = this.folderUrl + "images/cam1.png";
                            var ms = new PictureMarkerSymbol(folderPath, 28, 28);
                            var marker = new Graphic(mapPt, ms);
                            curViewer.graLoc = marker;
                            this._lyrCameraIcon.add(marker);
                        } else {
                            curViewer.graLoc.setGeometry(mapPt);
                        }
                        var rot = yaw * 180 / Math.PI;
                        curViewer.graLoc.symbol.setAngle(rot);

                        if (curViewer.graFOV) {
                            this._lyrCameraIcon.remove(curViewer.graFOV);
                        }
                        var ls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 1), 2);
                        var rgba = this._panoramaViewer.getViewerColor();
                        rgba[3] = 0.5; // set alpha
                        var fs = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, ls, new Color.fromArray(rgba));
                        var polygon = new Polygon(this.map.spatialReference);
                        polygon.addRing([[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y], [a.x, a.y]]);
                        var graphic = new Graphic(polygon, fs);
                        curViewer.graFOV = graphic;
                        this._lyrCameraIcon.add(graphic);
                        this._lyrCameraIcon.setVisibility(true);
                    }
                },

                _checkMapZoomLevel: function(){
                    var mapMaxZoom = this.map.getMaxZoom();
                    var setMapZoom;
                    if(mapMaxZoom > 20){
                        setMapZoom = mapMaxZoom - 5;
                    }else {
                        setMapZoom = mapMaxZoom - 3;
                    }
                    return setMapZoom;
                },

                // onMinimize: function(){
                //   console.log('onMinimize');
                // },

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

                resize: function(){
                    console.info('resize');
                    // TODO NOT an official api function. will be in the next api release (v16.1+)!
                    // recalculate size for panoramaviewer when widget resizes.
                    this._panoramaViewer._viewer.invalidateSize();
                }

                //methods to communication between widgets:

            });
        });
});
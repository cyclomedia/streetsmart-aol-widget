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
                name: 'Street Smart',        // TODO change!!

                // CM properties
                _color: '#005293',
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

                    // Use the Street Smart API proj4. All projection definitions are in there already.
                    utils.setProj4(CM.Proj4.getProj4());

                    var srs = 'EPSG:' + this.map.spatialReference.wkid;

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

                        this._panoramaViewer = StreetSmartApi.addPanoramaViewer(this.panoramaViewerDiv, {
                            recordingsVisible: true,
                            timeTravelVisible: true
                        });

                        this.initRecordingClient();

                        this.createLayers();

                        // onOpen will be called before api is initialized, so call this again.
                        this.onOpen();

                    }.bind(this));
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
                    if (this.map.getZoom() > 18 && this.state !== "closed") {
                        this._loadRecordings();
                    } else {
                        this._clearLayerGraphics(this._lyrRecordingPoints);
                        this._clearLayerGraphics(this._lyrCameraIcon);
                    }
                },

                createLayers: function() {
                    console.info('createLayers');
                    var rgb = new Color.fromString(this._color).toRgb();
                    rgb.push(0.5);
                    this._color = Color.fromArray(rgb);

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
                    this._lyrRecordingPoints = new FeatureLayer(emptyFeatureCollection);
                    //this._lyrRecordingPoints.setVisibility(false);
                    this._lyrRecordingPoints.setRenderer(ren);
                    on(this._lyrRecordingPoints, "click", this._clickRecordingPoint.bind(this));
                    this.map.addLayer(this._lyrRecordingPoints);

                    // CameraIcon Layer
                    this._lyrCameraIcon = new GraphicsLayer();
                    //this._lyrCameraIcon.setVisibility(false);
                    this.map.addLayer(this._lyrCameraIcon);
                },

                _loadRecordings: function() {
                    if (this.map.getZoom() > 18 && this._recordingClient) {
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
                    this._panoramaViewer = StreetSmartApi.addPanoramaViewer(this.panoramaViewerDiv, {
                        recordingsVisible: true,
                        timeTravelVisible: true
                    });
                    this._panoramaViewer.openByImageId(ptId);
                },

                onOpen: function(){
                    console.info('onOpen');

                    // Add extent change listener
                    if(!this._mapExtentChangeListener) {
                        this._mapExtentChangeListener = this.addEventListener(this.map, 'extent-change', this._onExtentChanged.bind(this));
                    }

                    if (this.map.getZoom() > 18) {
                        // If no recording loaded previously then use mapcenter to open one.
                        if (StreetSmartApi.getAPIReadyState() && !this._panoramaViewer.getRecording()) {
                            var pt = this.map.extent.getCenter();
                            var mapSRS = this.map.spatialReference.wkid;
                            var ptLocal = utils.transformProj4js(pt, mapSRS);

                            this._panoramaViewer.openByCoordinate([ptLocal.x, ptLocal.y]);
                            // this._updateViewerGraphics(this._panoramaViewer, ptLocal, false);
                        }
                        this._loadRecordings();
                    }
                },

                onClose: function(){
                  console.info('onClose');

                    // Remove extent change listener.
                    this._mapExtentChangeListener = this.removeEventListener(this._mapExtentChangeListener);

                    // Remove Graphics from layers.
                    this._clearLayerGraphics(this._lyrRecordingPoints);
                    this._clearLayerGraphics(this._lyrCameraIcon);
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
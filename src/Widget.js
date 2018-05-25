const REQUIRE_CONFIG = {
    async: true,
    locale: 'en',
    paths: {
        'react': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.min',
        'react-dom': 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.min',
        'openlayers': 'https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol',
        'lodash': 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min'
    }
};

require(REQUIRE_CONFIG, [], function () {
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
        'https://streetsmart.cyclomedia.com/api/v18.4/StreetSmartApi.js',
        './utils',
        './sldStyling',
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

            _initialized: false,
            _zoomThreshold: null,
            _viewerType: StreetSmartApi.ViewerType.PANORAMA,

            // CM properties
            _recordingColor: '#005293',
            _cmtTitleColor: '#98C23C',
            _apiKey: 'C3oda7I1S_49-rgV63wtWbgtOXcVe3gJWPAVWnAZK3whi7UxCjMNWzIJyv4Fmrcp',

            // Initial construction, might not be added to DOM yet.
            postCreate() {
                console.log('postCreate.');
                this.inherited(arguments);

                utils.setProj4(CM.Proj4.getProj4());

                this._applyWidgetStyle();
                this._determineZoomThreshold();
            },

            startup() {
                console.log('startup');
                this.inherited(arguments);
            },

            async _initApi() {
                console.log('_initApi', this.config);
                const CONFIG = {
                    targetElement: this.panoramaViewerDiv, // I have no idea where this comes from
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

                return StreetSmartApi.init(CONFIG).then(() => {
                    console.log('api init success');
                    this._initialized = true;
                }).then(() => {
                    this._centerViewerToMap();
                })
            },

            _applyWidgetStyle() {
                const panel = this.getPanel();

                // Set title color for Widget.
                if (panel.titleNode) {
                    panel.titleNode.style.backgroundColor = this._cmtTitleColor;
                    panel.titleLabelNode.style.color = 'white';
                }

                // Remove padding (white 'border') around viewer.
                panel.containerNode.children[0].style.padding = '0px';
            },

            _centerViewerToMap() {
                const mapCenter = this.map.extent.getCenter();
                const mapSRS = this.config.srs.split(':')[1];
                const localCenter = utils.transformProj4js(mapCenter, mapSRS);
                StreetSmartApi.open(
                    `${localCenter.x},${localCenter.y}`, {
                        viewerType: [this.viewerType],
                        srs: mapSRS
                    }
                );
            },

            _determineZoomThreshold: function () {
                const maxMapZoom = this.map.getMaxZoom();
                let zoomThreshold = maxMapZoom - 3;

                if (maxMapZoom > 20) {
                    zoomThreshold = maxMapZoom - 5;
                }
                this._zoomThreshold = zoomThreshold;
                return zoomThreshold;
            },

            onOpen() {
                const zoomLevel = this.map.getZoom();
                console.log('onOpen');

                // Only open when the zoomThreshold is reached.
                if (zoomLevel > this._zoomThreshold) {
                    this._initApi();
                }
            },

            onClose() {
                console.log('onClose', this.panoramaViewerDiv);
                StreetSmartApi.destroy({ targetElement: this.panoramaViewerDiv });
                this._initialized = false;
            },

            // communication method between widgets
            onReceiveData(name, widgetId, data, historyData) {
                console.log('onReceiveData', name, widgetId, data, historyData);
            },
        });
    });
});
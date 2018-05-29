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
        'dojo/on',
        'jimu/BaseWidget',
        'https://streetsmart.cyclomedia.com/api/v18.4/StreetSmartApi.js',
        './utils',
        './RecordingClient',
        './LayerManager',
    ], function (
         declare,
         on,
         BaseWidget,
         StreetSmartApi,
         utils,
         RecordingClient,
         LayerManager
    ) {
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
            _cmtTitleColor: '#98C23C',
            _apiKey: 'C3oda7I1S_49-rgV63wtWbgtOXcVe3gJWPAVWnAZK3whi7UxCjMNWzIJyv4Fmrcp',

            // Initial construction, might not be added to DOM yet.
            postCreate() {
                this.inherited(arguments);

                this.wkid = parseInt(this.config.srs.split(':')[1]);

                utils.setProj4(CM.Proj4.getProj4());

                this._recordingClient = new RecordingClient({
                    config: this.config,
                    apiKey: this._apiKey,
                    map: this.map,
                });
                this._layerManager = new LayerManager({
                    wkid: this.wkid,
                    map: this.map,
                    onRecordingLayerClick: this._handleRecordingClick.bind(this),
                });
                this._applyWidgetStyle();
                this._determineZoomThreshold();
            },

            startup() {
                this.inherited(arguments);
            },

            _handleRecordingClick(event) {
                const recordingId = event.graphic.attributes.recordingId;
                this.query(recordingId);
            },

            async _initApi() {
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
                    this._initialized = true;

                    this._loadRecordings();
                    this._centerViewerToMap();
                });
            },

            _bindEventHandlers() {
                this._extentChangeListener = on(this.map, 'extent-change', this._handleExtentChange.bind(this));
                this._extentChangeListener = on(this.map, 'zoom-end', this._handleConeChange.bind(this));
                this._viewChangeListener = on(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE,
                    this._handleConeChange.bind(this)
                );
                this._imageChangeListener = on(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE,
                    this._handleConeChange.bind(this)
                );
            },

            _handleConeChange(e) {
                this._layerManager.updateViewingCone(this._panoramaViewer);
            },

            _removeEventHandlers() {
                this._extentChangeListener.remove();
            },

            _handleExtentChange() {
                this._loadRecordings();
            },

            _loadRecordings() {
                if (this.map.getZoom() > this._zoomThreshold) {
                    this._recordingClient.load().then((response) => {
                        this._layerManager.updateRecordings(response);
                    });
                } else {
                    this._layerManager.updateRecordings([]);
                }
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
                this.query(`${localCenter.x},${localCenter.y}`);
            },

            query(query) {
                const mapSRS = this.config.srs.split(':')[1];
                return StreetSmartApi.open(query, {
                        viewerType: [this.viewerType],
                        srs: mapSRS
                    }
                ).then((res) => {
                    if (!this._panoramaViewer) {
                        this._panoramaViewer = res[0];
                        this._bindEventHandlers();
                    }
                });
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

                // Only open when the zoomThreshold is reached.
                // if (zoomLevel > this._zoomThreshold) {
                    this._initApi();
                // }
            },

            onClose() {
                StreetSmartApi.destroy({ targetElement: this.panoramaViewerDiv });
                this._initialized = false;
                this._removeEventHandlers();
            },

            // communication method between widgets
            onReceiveData(name, widgetId, data, historyData) {
                console.log('onReceiveData', name, widgetId, data, historyData);
            },
        });
    });
});
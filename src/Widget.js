const REQUIRE_CONFIG = {
    async: true,
    locale: 'en',
    paths: {
        'react': 'https://unpkg.com/react@16.2.0/umd/react.production.min',
        'react-dom': 'https://unpkg.com/react-dom@16.2.0/umd/react-dom.production.min',
        'openlayers': 'https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol',
        'lodash': 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min'
    }
};

require(REQUIRE_CONFIG, [], function () {
    return define([
        'dojo/_base/declare',
        'dojo/on',
        'jimu/BaseWidget',
        'https://streetsmart.cyclomedia.com/api/v18.6/StreetSmartApi.js',
        './utils',
        './RecordingClient',
        './LayerManager',
        './MeasurementsHandler'
    ], function (
         declare,
         on,
         BaseWidget,
         StreetSmartApi,
         utils,
         RecordingClient,
         LayerManager,
         MeasurementsHandler
    ) {
        //To create a widget, you need to derive from BaseWidget.
        return declare([BaseWidget], {
            // Custom widget code goes here
            baseClass: 'jimu-widget-streetsmartwidget',

            // This property is set by the framework when widget is loaded.
            name: 'Street Smart by CycloMedia',

            _zoomThreshold: null,
            _viewerType: StreetSmartApi.ViewerType.PANORAMA,
            _listeners: [],
            _measureChange: true,

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
                    setPanoramaViewerOrientation: this.setPanoramaViewerOrientation.bind(this),
                    addEventListener: this.addEventListener.bind(this),
                    removeEventListener: this.removeEventListener.bind(this),
                });
                this._measurementhandler = new MeasurementsHandler({
                    wkid: this.wkid,
                    map: this.map,
                    measureChange : this._measureChange,
                    addEventListener: this.addEventListener.bind(this),
                    layerManager: this._layerManager,
                    StreetSmartApi: StreetSmartApi

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
                    this.loadingIndicator.classList.add('hidden');
                    this._bindInitialMapHandlers();
                    this._loadRecordings();
                    this._centerViewerToMap();
                    this._measurementsChanges();
                });
            },

            _bindInitialMapHandlers() {
                const measurementChanged = StreetSmartApi.Events.measurement.MEASUREMENT_CHANGED
                this.addEventListener(StreetSmartApi, measurementChanged, this._handleMeasurementChanged.bind(this));
                this.addEventListener(this.map, 'extent-change', this._handleExtentChange.bind(this));
            },

            _handleMeasurementChanged(e) {
                const newViewer = e.detail.panoramaViewer;

                // Handle initial viewer creation
                if (!this._panoramaViewer && newViewer) {
                    this._panoramaViewer = newViewer;
                    this._layerManager.addLayers();
                    this._bindViewerDependantEventHandlers();
                    this._handleConeChange();
                    return;
                }

                if (newViewer !== this._panoramaViewer) {
                    this.removeEventListener(this._viewChangeListener);
                    this.removeEventListener(this._imageChangeListener);
                    this._panoramaViewer = newViewer;
                    this._bindViewerDependantEventHandlers({ viewerOnly: true});
                }
            },

            // Adds event listeners which are automatically
            // cleared onClose
            addEventListener(target, eventName, callback) {
                let listener = on(target, eventName, callback);

                // Using dojo on doesn't always return a listener.
                // For the panoramaViewer events it returns the panoramaViewer itself.
                if (!listener.remove) {
                    listener = {
                        remove: () => {
                            target.off(eventName, callback);
                        }
                    }
                }

                this._listeners.push(listener);
                return listener;
            },

            removeEventListener(listener) {
                listener.remove();

                const index = this._listeners.indexOf(listener);
                this._listeners.splice(index, 1);
            },

            _openApiWhenZoomedIn() {
                this.zoomWarning.classList.remove('hidden');
                const listener = this.addEventListener(this.map, 'zoom-end', (zoomEvent) => {
                    if (zoomEvent.level > this._zoomThreshold) {
                        this.zoomWarning.classList.add('hidden');
                        this._initApi();
                        this.removeEventListener(listener);
                    }
                });
            },

            _bindViewerDependantEventHandlers(options) {
                const opts = Object.assign({}, options, { viewerOnly: false });
                this._viewChangeListener = this.addEventListener(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, this._handleConeChange.bind(this));
                this._imageChangeListener = this.addEventListener(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, this._handleConeChange.bind(this));
                if (!opts.viewerOnly) {
                    this.addEventListener(this.map, 'zoom-end', this._handleConeChange.bind(this));
                }
            },

            // We do not use removeEventListener for this,
            // as removing stuff in an array is a bad idea.
            _removeEventListeners() {
                this._listeners.forEach((listener) => {
                    listener.remove();
                });
                this._listeners = [];
            },

            _handleConeChange() {
                this._layerManager.updateViewingCone(this._panoramaViewer);
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

            _measurementsChanges(){
                //adding measurement events to the viewer
                const measurementEvents = StreetSmartApi.Events.measurement;
                StreetSmartApi.on(measurementEvents.MEASUREMENT_CHANGED, measurementEvent => this._measurementhandler.viewerMeasurements(measurementEvent));
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

                // Manually fire these events as they are fired too early by the API,
                // we can't listen to them yet.
                this.query(`${localCenter.x},${localCenter.y}`);
            },

            query(query) {
                return StreetSmartApi.open(query, {
                        viewerType: [this.viewerType],
                        srs: this.config.srs,
                    }
                );
            },

            setPanoramaViewerOrientation(orientation) {
                const currentOrientation = this._panoramaViewer.getOrientation();
                this._panoramaViewer.setOrientation(Object.assign({}, currentOrientation, orientation));
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
                if (zoomLevel > this._zoomThreshold) {
                    this._initApi();
                } else {
                    this._openApiWhenZoomedIn();
                }
            },

            onClose() {
                StreetSmartApi.destroy({ targetElement: this.panoramaViewerDiv });
                this.loadingIndicator.classList.remove('hidden');
                this._removeEventListeners();
                this._layerManager.removeLayers();
                this._panoramaViewer = null;
            },

            // communication method between widgets
            onReceiveData(name, widgetId, data, historyData) {
                console.log('onReceiveData', name, widgetId, data, historyData);
            },
        });
    });
});
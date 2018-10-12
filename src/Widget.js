const REQUIRE_CONFIG = {
    async: true,
    locale: 'en',
    paths: {
        'react': 'https://unpkg.com/react@16.4.1/umd/react.production.min',
        'react-dom': 'https://unpkg.com/react-dom@16.4.1/umd/react-dom.production.min',
        'openlayers': 'https://cdnjs.cloudflare.com/ajax/libs/openlayers/4.3.3/ol',
        'lodash': 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.10/lodash.min'
    }
};

require(REQUIRE_CONFIG, [], function () {
    return define([
        'dojo/_base/declare',
        'dojo/on',
        'dojo/dom',
        'dojo/dom-construct',
        'dijit/Tooltip',
        'jimu/BaseWidget',
        'esri/geometry/ScreenPoint',
        'https://streetsmart.cyclomedia.com/api/v18.11/StreetSmartApi.js',
        './utils',
        './RecordingClient',
        './LayerManager',
        './MeasurementHandler',
        './OverlayManager',
        './FeatureLayerManager'
    ], function (
        declare,
        on,
        dom,
        domConstruct,
        Tooltip,
        BaseWidget,
        ScreenPoint,
        StreetSmartApi,
        utils,
        RecordingClient,
        LayerManager,
        MeasurementHandler,
        OverlayManager,
        FeatureLayerManager
    ) {
        //To create a widget, you need to derive from BaseWidget.
        return declare([BaseWidget], {
            // Custom widget code goes here
            baseClass: 'jimu-widget-streetsmartwidget',

            // This property is `set by the framework when widget is loaded.
            name: 'Street Smart by CycloMedia',

            _zoomThreshold: null,
            _viewerType: StreetSmartApi.ViewerType.PANORAMA,
            _listeners: [],
            _saveMeasurements: false,
            _measurementDetails: null,

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
                    config: this.config,

                    removeEventListener: this.removeEventListener.bind(this),
                });

                this._measurementHandler = new MeasurementHandler({
                    wkid: this.wkid,
                    map: this.map,
                    layer: this._layerManager.measureLayer,
                    StreetSmartApi: StreetSmartApi
                });

                this._overlayManager = new OverlayManager({
                    wkid: this.wkid,
                    map: this.map,
                    config: this.config,
                    StreetSmartApi: StreetSmartApi
                });

                this._featureLayerManager = new FeatureLayerManager({
                    map: this.map,
                    wkid: this.wkid,
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
                if (this.config.agreement !== true) {
                    alert(this.nls.agreementWarning);
                    return
                }

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
                });
            },

            _bindInitialMapHandlers() {
                const measurementChanged = StreetSmartApi.Events.measurement.MEASUREMENT_CHANGED;
                this.addEventListener(StreetSmartApi, measurementChanged, this._handleMeasurementChanged.bind(this));
                this.addEventListener(this.map, 'extent-change', this._handleExtentChange.bind(this));
            },

            _handleMeasurementChanged(e) {
                const newViewer = e.detail.panoramaViewer;
                this._handleViewerChanged(newViewer);
                this._measurementHandler.draw(e);
                if(dom.byId("saveMeasurementsBtn") !== null){
                    const {activeMeasurement} = e.detail;
                    this._measurementDetails = activeMeasurement;
                }
            },

            /**
             * Handles the viewer change and event handler rebinding,
             * starting measurement mode changes the viewer.
             */
            _handleViewerChanged(newViewer) {
                // Handle initial viewer creation
                if (!this._panoramaViewer && newViewer) {
                    this._panoramaViewer = newViewer;
                    this._layerManager.addLayers();
                    this._bindViewerDependantEventHandlers();
                    if (this.config.navigation !== true) {
                        this._hideNavigation();
                    }
                    if (this.config.measurement !== true) {
                        const measureBtn = StreetSmartApi.PanoramaViewerUi.buttons.MEASURE;
                        this._panoramaViewer.toggleButtonEnabled(measureBtn);
                    }
                    if(this.config.saveMeasurements === true){
                        this._showLayersButton();
                    }
                    this._handleImageChange();
                    this._drawDraggableMarker();

                    return;
                }

                // Update the event handlers and everything else once the viewer changed
                // Always make sure newViewer is set as newViewer can be undefined
                // while this._panoramaViewer can be null
                if (newViewer && newViewer !== this._panoramaViewer) {
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
                this._imageChangeListener = this.addEventListener(this._panoramaViewer, StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE, this._handleImageChange.bind(this));
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

            _handleImageChange() {
                this._handleConeChange();
                if (this.config.overlay === true) {
                    this._overlayManager.addOverlaysToViewer();
                }
            },

            _handleExtentChange() {
                this._loadRecordings();
            },

            _loadRecordings() {
                if (!this.config.navigation) {
                    return;
                }
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

                // Manually fire these events as they are fired too early by the API,
                // we can't listen to them yet.
                this.query(`${localCenter.x},${localCenter.y}`);
            },

            query(query) {
                return StreetSmartApi.open(query, {
                        viewerType: [this._viewerType],
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

            _hideNavigation() {
                this._panoramaViewer.toggleNavbarVisible();
                this._panoramaViewer.toggleTimeTravelVisible();
                setTimeout(() => {
                    this._panoramaViewer.toggleRecordingsVisible(false);
                });
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
                this._overlayManager.reset();
                this._removeEventListeners();
                this._layerManager.removeLayers();
                this._panoramaViewer = null;
            },

            _drawDraggableMarker() {
                const nav = this.panoramaViewerDiv.querySelector('.navbar .navbar-right .nav');
                const exampleButton = nav.querySelector('.btn');

                // Draw the actual button in the same style as the other buttons.
                const markerButton = dojo.create('button', {
                    id: 'addMapDropBtn',
                    class: exampleButton.className,
                    draggable: true,
                    ondragend: this._handleMarkerDrop.bind(this),
                });

                nav.appendChild(markerButton);
                const toolTipMsg = this.nls.tipDragDrop;

                new Tooltip({
                    connectId: markerButton,
                    label: toolTipMsg,
                    position: ['above']
                });
            },

            _handleMarkerDrop(e) {
                e.preventDefault();

                // Figure out on what pixels (relative to the map) the marker was dropped.
                const containerOffset = this.map.container.getBoundingClientRect();
                const mapRelativePixels = {
                    x: e.clientX - containerOffset.x,
                    y: e.clientY - containerOffset.y,
                };

                const sPoint = new ScreenPoint(mapRelativePixels.x, mapRelativePixels.y);
                const mPoint = this.map.toMap(sPoint);
                const vPoint = utils.transformProj4js(mPoint, this.wkid);

                this.query(`${vPoint.x},${vPoint.y}`);
            },

            _showLayersButton(){
                const nav = this.panoramaViewerDiv.querySelector('.navbar .navbar-right .nav');
                const exampleButton = nav.querySelector('.btn');

                // Draw the actual button in the same style as the other buttons.
                const editLayersButton = dojo.create('button', {
                    id: 'showLayersBtn',
                    class: exampleButton.className,
                    onclick: this._checkEditableLayers.bind(this),
                });

                nav.appendChild(editLayersButton);
                const toolTipMsg = this.nls.tipEditLayers;

                new Tooltip({
                    connectId: editLayersButton,
                    label: toolTipMsg,
                    position: ['above']
                });
            },

            _checkEditableLayers(){
                if(dom.byId("saveMeasurementLayersDiv") === null){
                    this._displayEditableLayers();
                }else{
                    domConstruct.destroy("saveMeasurementLayersDiv");
                }
            },

            _displayEditableLayers(){
                const layerDivs = this._filterEditableLayers();
                const nav = this.panoramaViewerDiv.querySelector('.cmtMousePosition');
                const overlayHtml = '<div id="saveMeasurementLayersDiv" class="cmtViewerPanel">' +
                    '<div class="cmtOverlayPanel cmtNavBarPanel panel panel-default">' +
                    '<div class="panel-heading">Select Layer To Save Measurements</div>'+
                    '<div class="panel-body">' +
                    '<div id="1" class="clearfix fix-bootstrap-row row">' +
                    '<div class="fix-bootstrap-col col-xs-3">' +
                    '<ul role="tablist" class="nav nav-pills nav-stacked">' +
                    '<li role="presentation" class="active"><a id="1-tab-1" role="tab" aria-controls="1-pane-1" aria-selected="true" href="#">Feature Layers</a></li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="fix-bootstrap-col col-xs-9">' +
                    '<div class="tab-content">' +
                    '<div id="1-pane-1" aria-labelledby="1-tab-1" role="tabpanel" aria-hidden="false" class="tab-pane active fade in">' +
                    '<div class="layerpanel panel-overlays panel panel-default" style="max-height: 345px;">' +
                    '<div class="panel-body">' +
                    '<table class="checklist table table-hover">' +
                    '<tbody id="layersTable">' +
                    '</tbody>' +
                    '</table>' +
                    '</div></div>' +
                    '<table class="checklist table table-hover">' +
                    '<tbody></tbody>' +
                    '</table></div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>'+
                    '</div>';
                const overlayDom = domConstruct.toDom(overlayHtml);
                domConstruct.place(overlayDom, nav, "after");
                const layerTableId = dom.byId("layersTable");
                _.each(layerDivs, (layer) => {
                    domConstruct.place(layer.layerDiv, layerTableId, );
                    this.saveLayerEvent = this.addEventListener(dom.byId(layer.id), 'click', () => this._SelectLayerToSave(layer));
                });

            },

            _filterEditableLayers(){
                const mapLayers = _.values(this.map._layers);
                const featureLayers = _.filter(mapLayers, l => l.type === 'Feature Layer');
                const editableLayers = _.filter(featureLayers, l => l.isEditable() === true );
                const displayLayerNames = [];
                _.each(editableLayers, (mapLayer) => {
                    const id = `editable-layer-${mapLayer.name}`;
                    const layerCheckBox = `<tr><td><div class="form-group" id="${id}">` +
                                            '<div class="checklist_location">' +
                                                '<div class="checkbox">' +
                                                    `<label title=""><input type="checkbox" value="off">` +
                                                        `<span>${mapLayer.name}</span>` +
                                                    '</label>' +
                                                '</div>' +
                                            '</div>' +
                                        '</div></td></tr>';
                    const layerHtml = domConstruct.toDom(layerCheckBox);
                    const layerNameUrl = {
                        url: mapLayer.url,
                        name: mapLayer.name,
                        layerDiv : layerHtml,
                        id
                    };
                    displayLayerNames.push(layerNameUrl);

                });
                return displayLayerNames;
            },

            _SelectLayerToSave(layer){
                if(dom.byId("saveMeasurementsBtn") !== null){
                    domConstruct.destroy("saveMeasurementsBtn");
                    this._saveMeasurements = false;
                }
                if(this._saveMeasurements === false) {
                    const nav = this.panoramaViewerDiv.querySelector('.navbar .navbar-right .nav');
                    const exampleButton = nav.querySelector('.btn');
                    // Draw the actual button in the same style as the other buttons.
                    const saveMeasurementsButton = dojo.create('button', {
                        id: 'saveMeasurementsBtn',
                        class: exampleButton.className
                    });
                    nav.appendChild(saveMeasurementsButton);
                    const toolTipMsg = this.nls.tipSaveMeasurement;

                    new Tooltip({
                        connectId: saveMeasurementsButton,
                        label: toolTipMsg,
                        position: ['above']
                    });
                    this._saveMeasurements = true;
                    this.addEventListener(dom.byId('saveMeasurementsBtn'), 'click', () => this._featureLayerManager._saveMeasurementsToLayer(layer,this._measurementDetails));
                }
            },

            // communication method between widgets
            onReceiveData(name, widgetId, data) {
                if (name !== 'Search'){
                    return;
                }
                
                if (data.selectResult) {
                    const searchedPoint = data.selectResult.result.feature.geometry;
                    const searchedPtLocal = utils.transformProj4js(searchedPoint, this.wkid);
                    this.query((`${searchedPtLocal.x},${searchedPtLocal.y}`));
                }
            },
        });
    });
});
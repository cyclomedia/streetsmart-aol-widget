define(['react', 'react-dom', './Components/sidePanel'], function (react, reactDom, SidePanel) {
    return class SidePanelManager {
        constructor({ sidePanel, panoramaViewerDiv, widget }) {
            this._sidePanelContainer = sidePanel;
            this._panoramaViewerDiv = panoramaViewerDiv;
            this._widget = widget;
            this.render();
            this.handleKeyPress = this.handleKeyPress.bind(this)
        }

        render(){
            reactDom.render(
                react.createElement(
                    SidePanel,
                    {
                        sidePanelContainer: this._sidePanelContainer,
                        panoramaViewerDiv: this._panoramaViewerDiv,
                        widget: this._widget,
                        togglePanel: this.toggleMeasurementSidePanel.bind(this),
                        selectLayer: this.selectLayer.bind(this),
                        selectGeometryType: this.selectGeometryType.bind(this),
                    }
                ),
                this._sidePanelContainer
            )
        }

        bindEventListeners() {
            window.document.addEventListener('keyup', this.handleKeyPress)
        }

        removeEventListeners() {
            window.document.removeEventListener('keyup', this.handleKeyPress)
        }

        handleKeyPress(e){
            if (document.activeElement.tagName === 'INPUT') return
            const {_widget, _lastSelectedLayer, _lastSelectedGeometryType} = this
            const {config : {saveMeasurements, buttonVisibility}, _measurementDetails, inMeasurement} = _widget

            if(!buttonVisibility.MEASURE) return;
            if(e.key !== 'n') return;

            if(inMeasurement && saveMeasurements && _measurementDetails){
+               _widget._saveMeasurement();
            }else if(!inMeasurement) {
                if(_lastSelectedLayer && _lastSelectedGeometryType ) {
                    _widget._selectedLayerID = _lastSelectedLayer
                    _widget.startMeasurement(_lastSelectedGeometryType);
                    this.toggleMeasurementSidePanel(false);
                } else if(saveMeasurements) {
                    this.toggleMeasurementSidePanel(true)
                }
            }
        }

        selectLayer(v){
            this._lastSelectedLayer = v
        }

        selectGeometryType(v){
            this._lastSelectedGeometryType = v

        }

        toggleMeasurementSidePanel(stance) {
            let newValue = this._sidePanelContainer && this._sidePanelContainer.classList.contains('hidden');
            if(stance !== undefined){
                newValue = stance;
            }

            //document.getElementById('streetSmartApi').appendChild(this._sidePanelContainer);

            if(newValue){
                this.showSidepanel();
            }else{
                this.hideSidePanel();
            }
        }

        showSidepanel(){
            this._sidePanelContainer.classList.remove('slide-out-panel');
        }

        hideSidePanel(){
            this._sidePanelContainer.classList.add('slide-out-panel');
        }
    }
});

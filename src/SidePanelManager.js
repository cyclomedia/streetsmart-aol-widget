define(['react', 'react-dom', './Components/sidePanel'], function (react, reactDom, SidePanel) {
    return class SidePanelManager {
        constructor({ sidePanel, panoramaViewerDiv, widget }) {
            this._sidePanelContainer = sidePanel;
            this._panoramaViewerDiv = panoramaViewerDiv;
            this._widget = widget;
            this.render();
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
                    }
                ),
                this._sidePanelContainer
            )
        }

        toggleMeasurementSidePanel(stance) {
            let newValue = this._sidePanelContainer.classList.contains('hidden');
            if(stance !== undefined){
                newValue = stance;
            }

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

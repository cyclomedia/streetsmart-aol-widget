define(['react', './Layer'], function (React, Layer) {
    return class MeasurementSidePanel extends React.Component {
        constructor() {
            super();
            this.state = {};
        }

        constructLayerList() {
            const map = this.props.widget.map;
            const ids = map.graphicsLayerIds;
            const list = [];

            for (const id of ids){
                const layer = map.getLayer(id);
                layer.type === 'Feature Layer' &&
                layer.isEditable() === true &&
                list.push(layer);
            }

            return list;
        }

        selectLayer(id) {
          this.setState({selectedLayer: id});
        };

        render(){
            const layerList = this.constructLayerList();
            return(
            <div id={'measurementPanel'}>
                <div className={'cmt close-button'}>
                    <button id={'side-panel-close-button'} className={'close-button glyphicon novaicon-navigation-down-3'} onClick={() => this.props.togglePanel(false)}></button>
                </div>
                <div className={'layers-list'}>
                    {layerList.map((l) => {
                        const isSelected = this.state.selectedLayer === l.id;
                        return (<Layer layer={l} isSelected={isSelected} selectLayer={() => {this.selectLayer(l.id)}} />)
                    })}
                </div>
                {   layerList.length &&
                    <div className={'measurement-types-list'}>
                        {layerList.map((l) => {
                            const isSelected = this.state.selectedLayer === l.id;
                            return (<Layer layer={l} isSelected={isSelected} selectLayer={() => {
                                this.selectLayer(l.id)
                            }}/>)
                        })}
                    </div>
                }
            </div>
            )
        }
    }
});

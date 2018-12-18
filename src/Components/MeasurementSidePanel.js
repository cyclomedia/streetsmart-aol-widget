const geomTypes = {
    POINT: 'POINT',
    LINE: 'LINE',
    POLYGON: 'POLYGON',
};
const EsriGeomTypes = {
    "esriGeometryPoint": [geomTypes.POINT],
    "esriGeometryPolyline": [geomTypes.LINE],
    "esriGeometryPolygon": [geomTypes.POLYGON]
};

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

        startMeasurement(type){
            const {widget, togglePanel} = this.props;
            this.props.widget._selectedLayerID = this.state.selectedLayer;
            widget.startMeasurement(type);
            togglePanel(false);
        }

        render(){
            const layerList = this.constructLayerList();
            const { widget, togglePanel } = this.props;
            const { nls } = widget;
            const { selectedLayer } = this.state;

            let layerGeometryTypes = []
            if(selectedLayer){
                const map = this.props.widget.map;
                const layer = map.getLayer(selectedLayer);
                layerGeometryTypes = EsriGeomTypes[layer.geometryType];
            }

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
                {   selectedLayer &&
                    <div className={'measurement-types-list'}>
                        <h2>{nls.startMeasurement}</h2>
                        <div className={'cmt measurement-button-container'}>
                            {layerGeometryTypes.includes(geomTypes.POINT) &&
                            <button
                                className={'measurement-button glyphicon novaicon-custom-dot'}
                                disabled={!layerGeometryTypes.includes(geomTypes.POINT)}
                                onClick={() => {
                                    this.startMeasurement(geomTypes.POINT)
                                }}
                            ></button>
                            }
                            {layerGeometryTypes.includes(geomTypes.LINE) &&
                            <button
                                className={'measurement-button glyphicon novaicon-organization-graph'}
                                disabled={!layerGeometryTypes.includes(geomTypes.LINE)}
                                onClick={() => {
                                    this.startMeasurement(geomTypes.LINE)
                                }}
                            ></button>
                            }
                            {layerGeometryTypes.includes(geomTypes.POLYGON) &&
                            <button
                                className={'measurement-button glyphicon novaicon-organization-flowchart-1'}
                                disabled={!layerGeometryTypes.includes(geomTypes.POLYGON)}
                                onClick={() => {
                                    this.startMeasurement(geomTypes.POLYGON)
                                }}
                            ></button>
                            }
                        </div>
                    </div>
                }
            </div>
            )
        }
    }
});
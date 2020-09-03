define(['react', './Layer', '../arcgisToGeojson'], function (React, Layer, geoUtils) {
    return class MeasurementSidePanel extends React.Component {
        constructor() {
            super();
            this.state = {
                selectedLayer: null
            };
        }

        constructLayerList() {
            const widget = this.props.widget
            const map = widget.map;
            const ids = map.graphicsLayerIds;
            const list = [];

            for (const id of ids){
                const layer = map.getLayer(id);

                if(
                    layer.type === 'Feature Layer' &&
                    layer.isEditable() === true &&
                    layer.getEditCapabilities().canCreate) {
                    list.push(layer);
                }
            }

            return list;
        }

        selectLayer(id) {
            const { selectLayer} = this.props;

            if(id === this.state.selectedLayer){
                this.setState({selectedLayer: null})
                selectLayer(null)
            }else{
                this.setState({selectedLayer: id});
                selectLayer(id)
            }
        };

        startMeasurement(type){
            const {widget, togglePanel, selectGeometryType} = this.props;
            selectGeometryType(type);
            widget._selectedLayerID = this.state.selectedLayer;
            widget.startMeasurement(type);
            togglePanel(false);
        }

        esriGeomToGeoJson(info) {
            const type = (info && info.geometryType) ? info.geometryType : info
            return geoUtils.EsriGeomTypes[type]
        }

        render(){
            const layerList = this.constructLayerList();
            const { widget, togglePanel } = this.props;
            const { nls, map } = widget;
            const { selectedLayer } = this.state;

            let layerGeometryTypes = [];
            if(selectedLayer){
                const layer = map.getLayer(selectedLayer);
                layerGeometryTypes = this.esriGeomToGeoJson(layer)
            }else{
                layerGeometryTypes = [geoUtils.geomTypes.POINT, geoUtils.geomTypes.LINE, geoUtils.geomTypes.POLYGON];
            }

            return(
            <div id={'measurementPanel'}>
                <div className={'cmt close-button'}>
                    <button id={'side-panel-close-button'} className={'close-button glyphicon novaicon-navigation-down-3'} onClick={() => togglePanel(false)}></button>
                </div>
                <div className={'layers-list'}>
                    {layerList.map((l) => {
                        const isSelected = this.state.selectedLayer === l.id;
                        return (<Layer layer={l} isSelected={isSelected} selectLayer={() => {this.selectLayer(l.id)}} />)
                    })}
                </div>
                    <div className={'measurement-types-list'}>
                        <h2>{nls.startMeasurement}</h2>
                        <div className={'cmt measurement-button-container'}>
                            <button
                                className={'measurement-button glyphicon novaicon-custom-dot'}
                                disabled={!layerGeometryTypes.includes(geoUtils.geomTypes.POINT)}
                                onClick={() => {
                                    this.startMeasurement(geoUtils.geomTypes.POINT)
                                }}
                            ></button>
                            <button
                                className={'measurement-button glyphicon novaicon-organization-graph'}
                                disabled={!layerGeometryTypes.includes(geoUtils.geomTypes.LINE)}
                                onClick={() => {
                                    this.startMeasurement(geoUtils.geomTypes.LINE)
                                }}
                            ></button>
                            <button
                                className={'measurement-button glyphicon novaicon-organization-flowchart-1'}
                                disabled={!layerGeometryTypes.includes(geoUtils.geomTypes.POLYGON)}
                                onClick={() => {
                                    this.startMeasurement(geoUtils.geomTypes.POLYGON)
                                }}
                            ></button>
                        </div>
                    </div>
            </div>
            )
        }
    }
});

define(['react', './MeasurementSidePanel'], function (React, MeasPanel) {
    return class SidePanel extends React.Component {
        constructor() {
            super();
        }

        render(){
            return <MeasPanel widget={this.props.widget} togglePanel={this.props.togglePanel}/>
        }
    }
});

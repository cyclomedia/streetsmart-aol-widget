define(['react'], function (React) {
    return class Layer extends React.Component {
        constructor() {
            super();
        }

        render(){
           const {layer, selectLayer, isSelected} = this.props;
           const className = isSelected ? 'layer-row selected' : 'layer-row';
           const checkboxClassName = isSelected ? 'checkbox-span selected' : 'checkbox-span';
            return(
                <div className={className} onClick={selectLayer}>
                    <span className={checkboxClassName}></span>
                   <label>{layer.name}</label>
                </div>
            )
        }
    }
});

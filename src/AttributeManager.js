define([
    'esri/dijit/AttributeInspector',
    'esri/geometry/Point',
    "esri/dijit/InfoWindow",
    "dojo/dom-construct",
    "dijit/form/Button",
    'esri/request',
], function (AttributeInspector, Point, InfoWindow, domConstruct, Button , esriRequest) {
    return class AttributeManager {
        constructor({ map, widget, wkid}) {
            this.map = map;
            this.wkid = wkid;
            this.widget = widget;
        }

        _constructLayerInfo(layer) {
            const layerInfos = [
                {
                    'featureLayer': layer,
                    'showAttachments': false,
                    'isEditable': layer.isEditable() && layer.capabilities.split(',').includes('Editing'),
                    'fieldInfos': layer.infoTemplate.info.fieldInfos
                }
            ];
            return layerInfos
        }

        _constructInspectorSettings(layer) {
            return {
                layerInfos: this._constructLayerInfo(layer)
            }
        }

        _applyUpdatesToLayer(layer, feature){
            const token = layer.credential && layer.credential.token;
            const options = {
                url: layer.url + "/applyEdits",
                content: {
                    f: "json"
                },
                handleAs: "json"
            };
            options.content.updates = JSON.stringify({attributes: feature.attributes});
            if (token) options.content.token = token;

            return esriRequest(options, { usePost: true });
        }

        _constructNewInspector(layer) {
            this.inspector && this.inspector.destroy()
            this.inspector = new AttributeInspector(
                this._constructInspectorSettings(layer)
            , domConstruct.create("div", {'class': 'cmt-attribute-inspector'}));

            this.inspector.on("delete", (evt) => {
                evt.feature.getLayer().applyEdits(null, null, [evt.feature]);
                this.map.infoWindow.hide();
                this.widget._overlayManager.addOverlaysToViewer()
            });

            const saveButton = new Button({ label: "Save", "class": "saveButton"},domConstruct.create("div"));
            domConstruct.place(saveButton.domNode, this.inspector.deleteBtn.domNode, "after");

            saveButton.on("click", () => {
                this.map.infoWindow.hide();
                this._applyUpdatesToLayer(layer, this.selectedFeature).then(() => {
                        this.widget._overlayManager.addOverlaysToViewer()
                });
            });

            this.inspector.on("attribute-change", (evt) => {
                //store the updates to apply when the save button is clicked
                this.selectedFeature.attributes[evt.fieldName] = evt.fieldValue;
            });

            this.inspector.on("next", (evt)  => {
                this.selectedFeature = evt.feature;
                console.log("Next " + this.selectedFeature.attributes[layer.objectIdField]);
            });


            return this.inspector
        }

        showInfoOfFeature(feature){
            const extent = feature.geometry.getExtent && feature.geometry.getExtent();
            const centroid = (extent && extent.getCenter()) || feature.geometry;
            this.map.infoWindow.show(new Point (centroid));
            this.map.infoWindow.setTitle('');
            this.map.centerAt(centroid)
            this.inspector.showFeature(feature);
            this.selectedFeature = feature
        }

        showInfoById(layer, featureID){
            const field = layer.objectIdField
            const feature = layer.graphics.find((g) => g.attributes[field] === featureID)
            if(feature){
                const insp = this._constructNewInspector(layer)
                this.map.infoWindow.setContent(insp.domNode);
                this.map.infoWindow.resize(350, 240);

                this.showInfoOfFeature(feature)
            }
        }
    }
});

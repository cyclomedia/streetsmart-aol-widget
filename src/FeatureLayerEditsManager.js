define([
    'dojo/on',
    'dojo/dom',
    'dojo/text!./EditableLayers.html',
    'dojo/dom-construct',
    'dijit/Tooltip',
    './FeatureLayerManager',
], function (
    on,
    dom,
    EditableLayers,
    domConstruct,
    Tooltip,
    FeatureLayerManager
) {
    'use strict';

    return class FeatureLayerEditManager {
        constructor({map, wkid, StreetSmartApi, addEventListener, panoramaViewerDiv, nls}) {
            this.map = map;
            this.wkid = wkid;
            this.StreetSmartApi = StreetSmartApi;
            this.addEventListener = addEventListener;
            this.panoramaViewerDiv = panoramaViewerDiv;
            this.nls = nls;
            this._saveMeasurements = false;
            this.featureLayerManager = new FeatureLayerManager({
                map: this.map,
                wkid: this.wkid,
                StreetSmartApi: this.StreetSmartApi
            });
        }

        _displayEditableLayers() {
            const layerDivs = this._filterEditableLayers();
            const nav = this.panoramaViewerDiv.querySelector('.cmtMousePosition');
            const overlayHtml = EditableLayers;
            const overlayDom = domConstruct.toDom(overlayHtml);
            domConstruct.place(overlayDom, nav, "after");
            const layerTableId = dom.byId("layersTable");
            _.each(layerDivs, (layer) => {
                domConstruct.place(layer.layerDiv, layerTableId,);
                this.addEventListener(dom.byId(layer.id), 'click', () => this._SelectLayerToSave(layer));
            });

        }

        _filterEditableLayers() {
            const mapLayers = _.values(this.map._layers);
            const featureLayers = _.filter(mapLayers, l => l.type === 'Feature Layer');
            const editableLayers = _.filter(featureLayers, l => l.isEditable() === true);
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
                    layerDiv: layerHtml,
                    id
                };
                displayLayerNames.push(layerNameUrl);

            });
            return displayLayerNames;
        }

        _SelectLayerToSave(layer) {
            if (dom.byId("saveMeasurementsBtn") !== null) {
                domConstruct.destroy("saveMeasurementsBtn");
                this._saveMeasurements = false;
            }
            if (this._saveMeasurements === false) {
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
                // this._featureLayerManager = new FeatureLayerManager({
                //     map: this.map,
                //     wkid: this.wkid,
                //     StreetSmartApi: this.StreetSmartApi
                // });
                this.addEventListener(dom.byId('saveMeasurementsBtn'), 'click', () => this.featureLayerManager._saveMeasurementsToLayer(layer));
            }
        }


    }

});
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/_base/Color",
    "dojo/Evented",
    "dojo/Deferred",
    "dojo/on",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/request",
    "esri/request",
    "dojo/json",
    "esri/layers/FeatureLayer",
    "esri/symbols/Font",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/TextSymbol",
    "esri/tasks/query",
    "esri/tasks/QueryTask",
    "esri/geometry/webMercatorUtils",
    "esri/geometry/Point",
    "esri/geometry/Extent",
    "esri/graphic",
    "esri/SpatialReference",
    "esri/IdentityManager",
    "./utils",
    "./Editor"
], function(declare, lang, array, Color, Evented, Deferred, on, dom, domConstruct, domStyle, request, esriRequest, JSON, FeatureLayer, Font, SimpleMarkerSymbol, SimpleLineSymbol, TextSymbol, Query, QueryTask, webMercatorUtils, Point, Extent, Graphic, SpatialReference, IdentityManager, utils, Editor) {
    "use strict";

    //TODO: maar één z-veld
    //var ALLOWED_FIELDNAMES_Z = ["cmt_z", "pan_z", "hotspot_height", "tag_height", "ht", "poleheight"]; //in order of preference, case insensitive. Always use lower case here.
    var ALLOWED_FIELDNAMES_Z = ["cmt_z"]; //in order of preference, case insensitive. Always use lower case here.
    //TODO: altijd displayField gebruiken
    var ALLOWED_FIELDNAMES_NAME = ["name", "title", "tag"];
    var SEARCH_RADIUS = 50;

    return declare("cm/streetsmart/components/FeatureManager", [Evented], {
        featureLayer: null,
        idField: null,  //TODO: remove, and just use featureLayer.objectIdField?
        zField: null,
        displayField: null,  //TODO: remove? Not used at the moment.
        editor: null,
        _clickHandler: null,
        _currentZ: null,
        _editsCompleteEvent: null,

        /**
         * Manages a feature layer for editing in the cyclorama viewer
         */
        constructor: function() {
            //TODO: editor moet een aparte widget worden
            //this.editor = new Editor();

            esriRequest.setRequestPreCallback(lang.hitch(this, function(args) {
                if (this.featureLayer && args.url.substr(0, this.featureLayer.url.length) === this.featureLayer.url) {
                    if (args.url.substr(args.url.length - 10).toLowerCase() === "applyedits" && args.content) {
                        //if (this.featureLayer.credential.token) { //TODO may be removed after testing all scenarios (esriRequest seems to be adding token automaticly)
                        //    args.content.token = this.featureLayer.credential.token;
                        //}
                        if (this._currentZ !== null && this._currentZ !== undefined) {
                            if (args.content.updates) {
                                var updates = JSON.parse(args.content.updates);
                                updates[0].geometry.z = this._currentZ;
                                args.content.updates = JSON.stringify(updates);
                            }
                            if (args.content.adds) {
                                var adds = JSON.parse(args.content.adds);
                                adds[0].geometry.z = this._currentZ;
                                args.content.adds = JSON.stringify(adds);
                            }
                        }
                    }
                    if (args.url.substr(args.url.length - 5).toLowerCase() === "query" && args.content && args.content.returnGeometry === true) {
                        args.content.returnZ = true;
                    }
                }
                return args;
            }));
        },

        /**
         * Sets a layer as active for editing
         * @param layer {FeatureLayer} The layer to activate
         * @returns {Deferred}
         */
        setLayer: function(layer) {
            var deferred = new Deferred();
            //var errormessage = "";

            this._checkLayer(layer).then(lang.hitch(this, function(layer) {

                if (layer.displayField) {
                    this.displayField = layer.displayField;
                } else {
                    this.displayField = this._findBestField(ALLOWED_FIELDNAMES_NAME, layer.fields);
                }
                //remove edits-complete event before setting new layer and edits-complete event
                if (this._editsCompleteEvent) this._editsCompleteEvent.remove();

                this.featureLayer = layer;

                if (this._clickHandler) this._clickHandler.remove(); //Clear old event handler if it's there
                this._clickHandler = on(this.featureLayer, "click", lang.hitch(this, function(event) {
                    //Query the feature that was clicked
                    var query = new Query();
                    query.objectIds = [event.graphic.attributes[this.featureLayer.objectIdField]];
                    this.featureLayer.queryFeatures(query, lang.hitch(this, function(result) {
                        //Store z value for manually saving after edit (the ArcGIS JS-API doesn't support 3D geometries)
                        this._currentZ = result.features[0].geometry.z;
                    }));

                    this.emit("featureclick", event);
                }));

                //TODO
                //this.editor.setLayer(this.featureLayer);

                this._editsCompleteEvent = on(this.featureLayer, "edits-complete", lang.hitch(this, function() {
                    this.emit("featurelayerupdated");
                }));

                this.emit("featurelayerupdated");

                deferred.resolve(layer);
            }), lang.hitch(this, function(errormessage) {
                if (errormessage) alert(errormessage);
                deferred.reject(errormessage);
            }));
            return deferred.promise;
        },

        /**
         * Checks if a layer can store z values; i.e. if it's a 3D layer or has a column for storing z values. If not, tries to add a column.
         * @param layer
         * @returns {*}
         * @private
         */
        _checkLayer: function(layer) {
            var deferred = new Deferred();

            this.idField = layer.objectIdField;
            //TODO: is this necessary? A layer probably always has an ID field.
            if (!this.idField) {
                var errormessage = "The selected layer does not define an ID field (objectIdField).";
                deferred.reject(errormessage);
            }

            var json = JSON.parse(layer._json);
            if (json.hasZ) {
                //3D geometry, so we don't need an attribute to store the z values
                this.zField = null;
                deferred.resolve(layer);
            } else {
                //Find an allowed field name with the lowest array index:
                this.zField = this._findBestField(ALLOWED_FIELDNAMES_Z, layer.fields, "esriFieldTypeDouble");
                if (this.zField === null) {
                    //TODO: werkt dit in alle browsers?
                    if (confirm("The selected layer is not a 3D layer, and does not have an attribute to store z-values. Would you like to add one?")) {
                        //The selected layer is not 3D (cannot store z values) and does not have a valid height column: add one.
                        var credential = IdentityManager.findCredential(PORTAL_HOST + "/sharing/rest");
                        var token = credential.token;
                        var adminurl = layer.url.replace("/rest/services/", "/rest/admin/services/");
                        request.post(adminurl + "/addToDefinition?f=json&token=" + token, {
                            //Remove header Dojo adds to prevent an OPTIONS request (CORS), because arcgis.com doesn't support it
                            headers: { "X-Requested-With": null },
                            data: {
                                "addToDefinition": JSON.stringify({
                                    fields: [{
                                        "name": "cmt_z",
                                        "type": "esriFieldTypeDouble",
                                        "alias": "cmt_z",
                                        "sqlType": "sqlTypeFloat",
                                        "nullable": true,
                                        "editable": true,
                                        "domain": null,
                                        "defaultValue": null
                                    }]
                                })
                            }
                        }).then(lang.hitch(this, function(result) {
                            var json = JSON.parse(result);
                            if (json.error) {
                                var errormessage = "Couldn't add column for z value to the selected layer (" + json.error.code + "): \"" + json.error.message + "\".";
                                if (json.error.message !== json.error.details[0]) {
                                    errormessage += " Details: " + json.error.details[0] + "\".";
                                }
                                deferred.reject(errormessage);
                            } else {
                                alert("We've added a column '" + ALLOWED_FIELDNAMES_Z[0] + "' to the selected layer to store z values.");
                                deferred.resolve(layer);
                            }
                        }), lang.hitch(this, function(result) {
                            var json = JSON.parse(result);
                            var errormessage = "Couldn't add column for z value to the selected layer: " + json.message;
                            deferred.reject(errormessage);
                        }));
                    } else {
                        //User cancelled
                        deferred.reject();
                    }
                } else {
                    //The layer has a valid attribute for z
                    deferred.resolve(layer);
                }
            }
            return deferred.promise;

        },

        /**
         * Find the first occurrance from allowedFields in fields[i].prop
         * @param allowedFields
         * @param fields
         * @param type (optional) return only fields of this type, e.g. "esriFieldTypeDouble"
         * @private
         */
        _findBestField: function(allowedFields, fields, type) {
            var result = null;
            var foundIndex = -1;
            for (var i = 0; i < fields.length; ++i) {
                var index = array.indexOf(allowedFields, fields[i].name.toLowerCase());
                if (index > -1 && (index < foundIndex || foundIndex == -1)) {
                    //Check field type, if given:
                    if (type !== undefined && fields[i].type !== type) {
                        continue;
                    }
                    result = fields[i].name;
                    foundIndex = index;
                }
            }
            return result;
        },

        /**
         * Query the featureLayer and return an array of features that the cyclorama viewer can display
         * @param x {float} X coordinate of the point to search around
         * @param y {float} Y coordinate of the point to search around
         * @param srs {string} SRS of the coordinates, should be the SRS of the viewer
         * @returns {Deferred} An array of objects
         */
        getFeaturesForViewer: function(x, y, srs) {
            var deferred = new Deferred();

            if (!this.featureLayer) {
                deferred.resolve([]);
                return deferred.promise;
            }

            var xmin = x - SEARCH_RADIUS,
                ymin = y - SEARCH_RADIUS,
                xmax = x + SEARCH_RADIUS,
                ymax = y + SEARCH_RADIUS;

            var queryTask = new QueryTask(this.featureLayer.url);

            var query = new Query();
            query.where = "";
            query.geometry = new Extent(xmin, ymin, xmax, ymax, new SpatialReference({ wkid: srs }));
            query.returnGeometry = true;
            query.outSpatialReference = new SpatialReference({ wkid: srs });
            query.outFields = ["*"];
            queryTask.execute(query, lang.hitch(this, function(result) {
                var features = [];
                for (var i = 0; i < result.features.length; i++) {
                    var f = result.features[i];
                    var symbol = this.featureLayer.renderer.getSymbol(f);
                    var marker = this._getTagMarker(f.attributes[this.idField], symbol);  //f.attributes[this.idField], f.attributes[this.displayField], symbol);  //DOM element for display in the viewer
                    var z = null;
                    if (this.zField) {
                        z = f.attributes[this.zField];
                    } else {
                        z = f.geometry.z || null;
                    }
                    features.push({
                        domElement: marker,
                        xyz: [f.geometry.x, f.geometry.y, z]
                    });

                    console.log("Feature for viewer: ", f.geometry.x, f.geometry.y, z, srs);
                }
                deferred.resolve(features);
            }), lang.hitch(this, function(error) {
                deferred.reject(error);
            }));

            return deferred.promise;
        },

        /**
         * Create a DOM Element to display in the cyclorama viewer
         * @param featureId {int} ID of the feature the DOM element represents
         * @param symbol {Symbol} Symbol to display
         * @returns {DomNode} A DOM element containing the symbol
         * @private
         */
        _getTagMarker: function(featureId, symbol) {  //id, tag, symbol) {
            //TODO: style as Object instead of String
            var tagMarker = domConstruct.create("div", {
                id: "tagMarker"
            });
            if (symbol) {
                var tagSymbol;
                if (symbol.type === "picturemarkersymbol") {
                    tagSymbol = domConstruct.create("img", {
                        id: 'tagSymbol',
                        src: symbol.url,
                        "style": {
                            "float": "left",
                            "width": symbol.width + "px",
                            "height": symbol.height + "px",
                            "margin-left": "-" + (symbol.width / 2) + "px",
                            "margin-top": "-" + (symbol.height / 2) + "px"
                        }
                    }, tagMarker);
                } else {
                    var border;
                    var symbolRadius = symbol.size;
                    if (symbol.outline) {
                        border = symbol.outline.width + 'px ' + symbol.outline.style + ' ' + new Color(symbol.outline.color);
                        symbolRadius += symbol.outline.width;
                    }
                    symbolRadius /= 2;
                    tagSymbol = domConstruct.create("div", {
                        id: 'tagSymbol',
                        "style": {
                            "float": "left",
                            "width": symbol.size + "px",
                            "height": symbol.size + "px",
                            "text-align": "center",
                            "moz-border-radius": "50%",
                            "-webkit-border-radius": "50%",
                            "border-radius": "50%",
                            "border": border,
                            "background-color": new Color(symbol.color) + "",
                            "margin-left": "-" + symbolRadius + "px",
                            "margin-top": "-" + symbolRadius + "px"
                        }
                    }, tagMarker);
                }
                on(tagSymbol, "click", lang.hitch(this, this.selectFeature, featureId));
            }

            return tagMarker;
        },

        /**
         * Select a feature and display the info or edit popup
         * @param featureId ID of the feature to select
         */
        selectFeature: function(featureId) {
            //Close infowindow, clear existing selection and refresh the layer.
            //(Refresh is needed to get the right x, y after a remeasurement. Refresh does not refresh the selected feature(s), that's why we have to deselect first.)
            var infoWindow = this.featureLayer.getMap().infoWindow;
            if (this.editor._editorWidget) {
                infoWindow.hide();
                this.featureLayer.clearSelection();
                this.featureLayer.refresh();  //TODO: dit alleen doen wanneer strikt noodzakelijk. Alleen in editmode
            }

            //Now query the feature to select:
            var query = new Query();
            query.objectIds = [featureId];
            this.featureLayer.selectFeatures(query, FeatureLayer.SELECTION_NEW, lang.hitch(this, function(features) {
                if (this.editor._editorWidget) {
                    //Save the z value so we can save it later; the ArcGIS JS-API doesn't do this :-(
                    this._currentZ = features[0].geometry.z;
                    //HACK: set the current graphic of the Editor widget:
                    this.editor._editorWidget._currentGraphic = features[0];
                }

                console.log("Selected feature", features[0].geometry.x, features[0].geometry.y, features[0].geometry.z, features[0].attributes[this.zField], features[0].geometry.spatialReference.wkid);

                /*
                 var origgeom = utils.transformProj4js(features[0].geometry, 28918);
                 console.log("Transformed back to original geometry")
                 */

                //Transform point that was just added to map SRS and show the info window containing the editor's attribute inspector (edit fields)
                var geom = utils.transformProj4js(features[0].geometry, this.featureLayer.getMap().spatialReference.wkid);

                if (!this.editor._editorWidget) {
                    //If not editing, set feature for info popup
                    infoWindow.setFeatures(features);
                }
                infoWindow.show(geom, this.featureLayer.getMap().getInfoWindowAnchor(geom));
            }));
        },

        /**
         * Create a new feature and add it to the featurelayer.
         * @param x {double} x-coordinate of the point to add, in viewer SRS
         * @param y {double} y-coordinate of the point to add, in viewer SRS
         * @param z {double} z-coordinate of the point to add, in viewer SRS
         * @param srs {integer} SRS of the viewer
         * @param updateFeature {Boolean} indicates whether the feature is being updated (true) or newly created (false)
         */
        createFeature: function(x, y, z, srs, updateFeature) {
            var deferred = new Deferred();
            var ptjson = { "x": x, "y": y, "z": z, "spatialReference": { wkid: srs } };
            var point = new Point(ptjson);

            //Transform from viewer SRS to featurelayer SRS:
            utils.transform(point, this.featureLayer.spatialReference.wkid, lang.hitch(this, function(geometries) {
                if (geometries.length > 0) {

                    //var geom2 = utils.transformProj4js(point, this.featureLayer.spatialReference.wkid);
                    //geometries[0] = geom2;

                    //Set values for required fields, so we can save the feature:
                    var attr = {};
                    if (!updateFeature) {
                        for (var i = 0; i < this.featureLayer.fields.length; ++i) {
                            var field = this.featureLayer.fields[i];
                            if (!field.nullable && field.name !== this.featureLayer.objectIdField && field.name !== this.featureLayer.globalIdField && field.name !== this.featureLayer.typeIdField) {
                                if (field.type == "esriFieldTypeString") {
                                    attr[field.name] = " ";
                                } else {
                                    attr[field.name] = 0;
                                }
                                //TODO: blob etc?
                            }
                            if (field.name === this.featureLayer.typeIdField) {
                                if (field.type == "esriFieldTypeString") {
                                    var selectedItem = this.editor._editorWidget.templatePicker.getSelected();
                                    if (selectedItem && selectedItem.template) {
                                        attr[field.name] = selectedItem.type.id;
                                    }
                                }
                            }
                        }
                    } else {
                        attr = updateFeature.attributes;
                    }

                    var jsonpt = {
                        "x": geometries[0].x,
                        "y": geometries[0].y,
                        "spatialReference": { wkid: geometries[0].spatialReference.wkid }
                    };

                    //Set z value:
                    if (this.zField) {
                        attr[this.zField] = z;
                    } else {
                        jsonpt.z = z;
                    }

                    this._currentZ = z;

                    var pt = new Point(jsonpt);
                    var gra = new Graphic(pt, null, attr);

                    ////TODO: is het mogelijk hier op te slaan in viewer SRS en transformatie op de server te laten plaatsvinden? Transformatie hierboven is dan niet nodig.
                    ////We're creating our own POST request to the AGO REST API here, because the Javascript API doesn't support z values in coordinates.
                    //request.post(this.featureLayer.url + "/applyEdits", options ).then(lang.hitch(this, this._onFeatureAdded), lang.hitch(this, this._errorHandler));
                    var options = {
                        url: this.featureLayer.url + "/applyEdits",
                        content: {
                            f: "json"
                        },
                        handleAs: "json"
                    };
                    if (updateFeature) {
                        options.content.updates = JSON.stringify([gra]);
                    } else {
                        options.content.adds = JSON.stringify([gra]);
                    }

                    console.log("Storing point ", pt.x, pt.y, z, pt.spatialReference.wkid);

                    var requestHandle = esriRequest(options, { usePost: true });
                    requestHandle.then(lang.hitch(this, function(json) {
                        this._onFeatureAdded(json);
                        deferred.resolve([]);
                    }), lang.hitch(this, function(results) {
                        this._errorHandler(results);
                        deferred.reject([]);
                    }));
                }
            }));
            return deferred.promise;
        },
        _onFeatureAdded: function(json) {
            this.emit("featurelayerupdated");

            var feature = null;
            if (json.addResults && json.addResults.length > 0) feature = json.addResults[0];
            if (json.updateResults && json.updateResults.length > 0) feature = json.updateResults[0];
            if (feature) {
                //Query the feature that was just added and pass it on to the Editor widget
                this.selectFeature(feature.objectId);
            }
        },
        _errorHandler: function(results) {
            console.error("Error adding/updating/deleting feature:");
            console.log(results);
        }
    });
});
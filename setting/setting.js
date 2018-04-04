define([
        'dojo/_base/declare',
        'dojo/_base/lang',
        'dojo/_base/array',
        'dojo/request',
        'dojo/dom',
        'dojo/on',
        'dojo/store/Memory',
        'dijit/form/FilteringSelect',
        'dijit/_WidgetsInTemplateMixin',
        'jimu/BaseWidgetSetting',
        './commonmark',
        './xml2json'
    ], function(declare, lang,dojoArray, dRequest, dom, on, Memory, FilteringSelect, _WidgetsInTemplateMixin, BaseWidgetSetting, commonmark, xml2js) {

        return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
            baseClass: 'jimu-widget-streetsmartwidget-setting',

            postCreate:function() {
                this.inherited(arguments);
                this.getSrsData();

                if(this.config) {
                    this.setConfig(this.config);
                } else {
                    this.getConfig();
                }

            },
            startup: function() {
                let self = this;
                on(dom.byId('userAgreementLink'), 'click', function(){
                    let agreementDataNode = dom.byId('agreementData');
                    let agreementPane = dom.byId('agreementContainer');
                    self.getConfig();
                    let settingLocale = dojoConfig.locale;
                    let url = self.folderUrl + 'setting/agreementCMT/agreement_' + settingLocale + '.md';
                    require(['dojo/text!' + url], function(text) {
                        let reader = new commonmark.Parser();
                        let writer = new commonmark.HtmlRenderer();
                        let parsed = reader.parse(text);
                        let result = writer.render(parsed);
                        agreementDataNode.innerHTML = result;
                        agreementPane.style.display = 'block';
                    });
                });

            },

            setConfig:function(config) {
                console.log("setconfig", config);

                this.config = config;

                if(this.config.locale){
                    this.selectCyclomediaLocation.set("value", this.config.locale);
                }
                if(this.config.uName){
                    this.uNameCyclomedia.value = this.config.uName;
                }
                if(this.config.uPwd){
                    this.uPwdCyclomedia.value = this.config.uPwd;
                }
                if(this.config.agreement){
                    this.agreementCheck.value = this.config.agreement;
                }
                if(this.config.srs){
                    this.srsCyclomedia.value = this.config.srs;
                }
                if(this.config.measurement){
                    this.measuementEnable.value = this.config.measurement;
                }
                if(this.config.overlay){
                    this.overlayEnable.value = this.config.overlay;
                }
                if(this.config.navigation){
                    this.navigationEnable.value = this.config.navigation;
                }

            },

            getConfig: function () {
                this.config.locale = this.selectCyclomediaLocation.value;
                this.config.uName = this.uNameCyclomedia.value;
                this.config.uPwd = this.uPwdCyclomedia.value;
                this.config.agreement = this.agreementCheck.value;
                this.config.srs = dijit.byId('srsComboBox').value;
                this.config.measurement = document.getElementById('enableMeasurement').checked;
                this.config.overlay = document.getElementById('enableOverlay').checked;
                this.config.navigation = document.getElementById('enableNavigation').checked;
                console.log("getconfig", this.config);
                return this.config;
            },

            getSrsData: function(){

                let self = this;
                let srsFinal = [];
                const spatialReferences =  "https://atlas.cyclomedia.com/spatialreferences/SpatialReferences.xml";


                dRequest(spatialReferences, {headers: {"X-Requested-With": null}})
                    .then(lang.hitch(this, function(srsData){
                        let srsJson = toJSON(srsData);
                        dojoArray.forEach(srsJson.children, function(spatialreference, i ) {
                            let srsObj = {};
                            srsObj['Name'] = spatialreference.children[0].content;
                            srsObj['SRSName'] = spatialreference.children[1].content;
                            srsObj['SRSDimension'] = spatialreference.children[2].content;
                            srsObj['Units'] = spatialreference.children[3].content;
                            let nativeObj = {};
                            let wgsObj = {};
                            nativeObj['MinX'] = spatialreference.children[4].children[0].content;
                            nativeObj['MinY'] = spatialreference.children[4].children[1].content;
                            nativeObj['MaxX'] = spatialreference.children[4].children[2].content;
                            nativeObj['MaxY'] = spatialreference.children[4].children[3].content;
                            wgsObj['MinX'] = spatialreference.children[5].children[0].content;
                            wgsObj['MinY'] = spatialreference.children[5].children[1].content;
                            wgsObj['MaxX'] = spatialreference.children[5].children[2].content;
                            wgsObj['MaxY'] = spatialreference.children[5].children[3].content;
                            srsObj['NativeBounds'] = self.parseExtent(nativeObj);
                            srsObj['WGSBounds'] = self.parseExtent(wgsObj);
                            srsObj['Proj4'] = spatialreference.children[6].content;
                            if (spatialreference.children[7]) {
                                srsObj['"ESRICompatibleName"'] = spatialreference.children[7].content;
                            }
                            srsFinal.push(srsObj);
                        });

                        let srsDisplay = [];
                        dojoArray.forEach(srsFinal, function(spat, i){
                            let srsDisplayName = {};
                            srsDisplayName["name"] = spat.SRSName + ' - ' + spat.Name;
                            srsDisplayName["id"] = spat.SRSName;
                            srsDisplay.push(srsDisplayName);
                        });
                        srsDisplay.sort(function(a,b){
                            return parseInt(a.id.substr(5)) - parseInt(b.id.substr(5));
                        });
                        let srsStore = new Memory({data : srsDisplay});

                        let srsDropDown = new FilteringSelect({
                            id : "srsComboBox",
                            name : "SRS",
                            value : "",
                            store : srsStore,
                            SearchAttr : "srs",
                            queryExpr : '*${0}*',
                            autoComplete : false,
                            placeholder : this.nls.typeSrs
                        }, "srsComboBox");
                        srsDropDown.startup();

                    }),
                    function (error) {
                        console.log(error);
                    });
                //return srsFinal;
            },

             parseExtent : function(node) {
                // Actually just an array with 4 floats: [minx, miny, maxx, maxy].
                return [
                    parseFloat(node.MinX),
                    parseFloat(node.MinY),
                    parseFloat(node.MaxX),
                    parseFloat(node.MaxY)
        ];
    }


        });
    });




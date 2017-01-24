define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/dom',
    "dojo/on",
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    './commonmark'
], function(declare, lang, dom, on, _WidgetsInTemplateMixin, BaseWidgetSetting, commonmark) {

    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
        baseClass: 'jimu-widget-streetsmartwidget-setting',

        postCreate:function() {
            this.inherited(arguments);

            if(this.config) {
                this.setConfig(this.config);
            } else {
                this.getConfig();
            }
            
        },
        startup: function() {
            var self = this;
            on(dom.byId('userAgreementLink'), 'click', function(){
                var agreementDataNode = dom.byId('agreementData');
                var agreementPane = dom.byId('agreementContainer');
                self.getConfig();
                var settingLocale = dojoConfig.locale;
                var url = self.folderUrl + 'setting/agreementCMT/agreement_' + settingLocale + '.md';
                console.log(url);
                require(['dojo/text!' + url], function(text) {
                    var reader = new commonmark.Parser();
                    var writer = new commonmark.HtmlRenderer();
                    var parsed = reader.parse(text);
                    var result = writer.render(parsed);
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

            

        },

        getConfig: function () {
            this.config.locale = this.selectCyclomediaLocation.value;
            this.config.uName = this.uNameCyclomedia.value;
            this.config.uPwd = this.uPwdCyclomedia.value;
            this.config.agreement = this.agreementCheck.value;
            console.log("getconfig", this.config);

            return this.config;
        }

    });
});
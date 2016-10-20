define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/dom',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting'
], function(declare, lang, dom, _WidgetsInTemplateMixin, BaseWidgetSetting) {

    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
        baseClass: 'jimu-widget-streetsmartwidget-setting',

        postCreate:function(){
            this.inherited(arguments);

            if(this.config){
                this.setConfig(this.config);
            }
        },

        setConfig:function(config){
            console.log("setconfig", config);
 
            this.config = config;

            // if (this.config.recordingSource) {
            //     this.selectRecordingSource.set("value", this.config.recordingSource);
            // }
            if(this.config.locale){
            	this.selectCyclomediaLocation.set("value", this.config.locale);
            }
            if(this.config.uName){
            	this.uNameCyclomedia.value = this.config.uName;
            }
            if(this.config.uPwd){
            	this.uPwdCyclomedia.value = this.config.uPwd;
            }
        },

        getConfig: function () {
            //this.config.recordingSource = this.selectRecordingSource.value;
            this.config.locale = this.selectCyclomediaLocation.value;
            this.config.uName = this.uNameCyclomedia.value;
            this.config.uPwd = this.uPwdCyclomedia.value;
            console.log("getconfig", this.config);

            return this.config;
        }

    });
});
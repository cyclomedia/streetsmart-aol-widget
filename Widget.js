// window.ATLAS_HOST = "https://atlas.cyclomedia.com";
// window.TILES_HOST = "https://cyclotiles.blob.core.windows.net/streetsmarttiles";

var dojoConfig = {
    async: true,
    locale: 'en',
    paths: {
        "react": "https://cdnjs.cloudflare.com/ajax/libs/react/15.3.0/react.min",
        "react-dom": "https://cdnjs.cloudflare.com/ajax/libs/react/15.3.0/react-dom.min",
        "openlayers": "https://cdnjs.cloudflare.com/ajax/libs/ol3/3.17.1/ol",
    }
};

require(dojoConfig, [], function() {
    return define([
        'dojo/_base/declare',
        'dojo/dom',
        'dojo/dom-style',
        'jimu/BaseWidget',
            "http://streetsmart.cyclomedia.com/api/v16.1/Aperture.js",
            "https://streetsmart.cyclomedia.com/api/v16.1/StreetSmartApi.js"],
        function (declare, dom, domStyle, BaseWidget, Aperture, StreetSmartApi) {
            //To create a widget, you need to derive from BaseWidget.
            return declare([BaseWidget], {
                // Custom widget code goes here

                baseClass: 'jimu-widget-streetsmartwidget',

                //this property is set by the framework when widget is loaded.
                name: 'CustomWidget',
                panoramaViewer: null,
                recordingClient: null,
                lyrRecordingPoints: null,
                lyrCameraIcon: null,
                featureManager: null,
                utils: null,
                _color: "#005293",



                //methods to communication with app container:

                postCreate: function() {
                  this.inherited(arguments);
                  console.log('postCreate');

                  var uName = this.config.uName;
                  var uPwd = this.config.uPwd;
                  var loc = this.config.locale;
                  var srs = "EPSG:" + this.map.spatialReference.wkid;
                  StreetSmartApi.init({
                    username: uName,
                    password: uPwd,
                    apiKey: '6vEZuXUl6PQRiPkp-XwROvENWPk56fA5-_wNKHEVSrQFifU5ebcd-PUFqfABOnAZ',
                    srs: srs,
                    locale: loc,
                    addressSettings: {
                        locale: loc,
                        database: "CMDatabase"
                    }
                  }).then(function(){
                      console.log('Api init success');
                      this.panoramaViewer = StreetSmartApi.addPanoramaViewer(this.panoramaViewerDiv, {
                          recordingsVisible: true,
                          timeTravelVisible: true
                      });
                      this.panoramaViewer.openByImageId('5D123456');
                  }.bind(this));


                },

                startup: function() {
                    this.inherited(arguments);
                    // this.mapIdNode.innerHTML = 'map id:' + this.map.id;
                    console.log('startup');
                }//,

                // _loginSubmit : function(e){
                //   dojo.stopEvent(e);
                //   console.log('clicked me!');
                //   var uName, uPwd;
                //   uName = dom.byId("userName").value;
                //   uPwd = dom.byId("password").value;
                // }

                // onOpen: function(){
                //   console.log('onOpen');
                // },

                // onClose: function(){
                //   console.log('onClose');
                // },

                // onMinimize: function(){
                //   console.log('onMinimize');
                // },

                // onMaximize: function(){
                //   console.log('onMaximize');
                // },

                // onSignIn: function(credential){
                //   /* jshint unused:false*/
                //   console.log('onSignIn');
                // },

                // onSignOut: function(){
                //   console.log('onSignOut');
                // }

                // onPositionChange: function(){
                //   console.log('onPositionChange');
                // },

                // resize: function(){
                //   console.log('resize');
                // }

                //methods to communication between widgets:

            });
        });
});
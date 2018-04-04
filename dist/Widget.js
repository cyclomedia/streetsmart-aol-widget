var cmtDojoConfig={async:true,locale:'en',paths:{'react':'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.min','react-dom':'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.min','openlayers':'https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol','lodash':'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min'}};require(cmtDojoConfig,[],function(){return define(['dojo/_base/declare','dojo/dom','dojo/_base/lang','dojo/on','dojo/_base/array','dojo/dom-style','dojo/_base/Color','dojo/dom-attr','dijit/Tooltip','esri/graphic','esri/layers/FeatureLayer','esri/layers/GraphicsLayer','esri/geometry/Point','esri/geometry/Polygon','esri/geometry/ScreenPoint','esri/SpatialReference','esri/renderers/SimpleRenderer','esri/symbols/PictureMarkerSymbol','esri/symbols/SimpleMarkerSymbol','esri/symbols/SimpleLineSymbol','esri/symbols/SimpleFillSymbol','esri/symbols/TextSymbol','esri/geometry/Polyline','esri/layers/LabelLayer','esri/tasks/QueryTask','esri/tasks/query','esri/request','jimu/BaseWidget','https://streetsmart.cyclomedia.com/api/v18.1/StreetSmartApi.js','./js/utils','./js/sldStyling','https://unpkg.com/shpjs@latest/dist/shp.js','https://cdnjs.cloudflare.com/ajax/libs/ol3/4.0.1/ol.js'],function(declare,dom,lang,on,dojoArray,domStyle,Color,domAttr,Tooltip,Graphic,FeatureLayer,GraphicsLayer,Point,Polygon,ScreenPoint,SpatialReference,SimpleRenderer,PictureMarkerSymbol,SimpleMarkerSymbol,SimpleLineSymbol,SimpleFillSymbol,TextSymbol,Polyline,LabelLayer,QueryTask,Query,esriRequest,BaseWidget,StreetSmartApi,utils,sldStyling,Shp,ol){//To create a widget, you need to derive from BaseWidget.
return declare([BaseWidget],{// Custom widget code goes here
baseClass:'jimu-widget-streetsmartwidget',// This property is set by the framework when widget is loaded.
name:'Street Smart by CycloMedia',// CM properties
_recordingColor:'#005293',_cmtTitleColor:'#98C23C',_apiKey:'C3oda7I1S_49-rgV63wtWbgtOXcVe3gJWPAVWnAZK3whi7UxCjMNWzIJyv4Fmrcp',_panoramaViewer:null,_recordingClient:null,_lyrRecordingPoints:null,_lyrCameraIcon:null,_measureLayer:null,_overlayLayer:null,_overlayId:null,_prePoint:null,_mapExtentChangeListener:null,// Methods to communication with app container:
postCreate:function postCreate(){this.inherited(arguments);console.info('postCreate');this.measureChange=true;this.JsonLayerButton=false;this.streetSmartInitiated=true;this.arrayOverlayIds={};this.lineOverlayIds={};this.polyOverlayIds={};// Set title color for Widget.
// Via css (.jimu-on-screen-widget-panel>.jimu-panel-title) all widgets are affected.
if(this.getPanel().titleNode){this.getPanel().titleNode.style.backgroundColor=this._cmtTitleColor;this.getPanel().titleLabelNode.style.color='white'}// Remove padding (white 'border') around viewer.
// Via css (.jimu-widget-frame.jimu-container) all widgets are affected.
this.getPanel().containerNode.children[0].style.padding='0px';// Use the Street Smart API proj4. All projection definitions are in there already.
utils.setProj4(CM.Proj4.getProj4());//set the Map zoom level to load the recordings.
this.mapZoomLevel=this._checkMapZoomLevel();//set the viewer type for the widget.
this.viewerType=StreetSmartApi.ViewerType.PANORAMA;//let srs = 'EPSG:' + this.map.spatialReference.wkid;
var viewDiv=this.panoramaViewerDiv;if(this.config.agreement!=='accept'){alert('Please accept the CycloMedia terms and agreements in the widget settings')}else{var stsmInit={targetElement:viewDiv,username:this.config.uName,password:this.config.uPwd,apiKey:this._apiKey,srs:this.config.srs,locale:this.config.locale,configurationUrl:this.config.atlasHost+'/configuration',addressSettings:{locale:this.config.locale,database:'Nokia'}};StreetSmartApi.init(stsmInit).then(function(){var _this=this;console.info('Api init success');this.initRecordingClient();this.createLayers();// onOpen will be called before api is initialized, so call this again.
this.onOpen();//adding measurement events to the viewer
var msEvents=StreetSmartApi.Events.measurement;StreetSmartApi.on(msEvents.MEASUREMENT_CHANGED,function(measurementEvent){return _this._handleMeasurements(measurementEvent)})}.bind(this)).catch(function(){console.log('API init Failed');alert('Street Smart API initiation Failed')})}},startup:function startup(){this.inherited(arguments);console.info('startup')},initRecordingClient:function initRecordingClient(){console.info('initRecordingClient');var basicToken=btoa(this.config.uName+':'+this.config.uPwd);var authHeader={'Authorization':'Basic '+basicToken};if(this.config.atlasHost){this._recordingClient=new CM.aperture.WfsRecordingClient({uriManager:new CM.aperture.WfsRecordingUriManager({apiKey:this._apiKey,dataUri:this.config.atlasHost+'/recording/wfs',withCredentials:true}),authHeaders:authHeader})}else{console.warn('No CycloMedia atlas host configured.')}},addEventListener:function addEventListener(element,type,callback){if(element&&type&&callback){return on(element,type,callback)}else{console.warn('Invalid parameters');return null}},removeEventListener:function removeEventListener(listener){if(listener&&typeof listener.remove==='function'){listener.remove();return null}},_onExtentChanged:function _onExtentChanged(){if(this.map.getZoom()>this.mapZoomLevel&&this.state!=='closed'){this._loadRecordings();if(this.config.overlay===true){this._displayFeatures()}}else{this._clearLayerGraphics(this._lyrRecordingPoints);this._lyrCameraIcon.setVisibility(false)}},createLayers:function createLayers(){var _this2=this;console.info('createLayers');var rgb=new Color.fromString(this._recordingColor).toRgb();rgb.push(0.5);this._recordingColor=Color.fromArray(rgb);var ms=new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE,9,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([255,255,255]),1),new Color.fromArray(rgb));var ren=new SimpleRenderer(ms);var emptyFeatureCollection={'layerDefinition':{'geometryType':'esriGeometryPoint','fields':[{'name':'id','alias':'ID','type':'esriFieldTypeOID'}]},'featureSet':null};//Read Feature Layers from the Map and display on the GeoCyclorama
if(this.config.overlay===true){this._displayFeatures()}// RecordingLayer
this._lyrRecordingPoints=new FeatureLayer(emptyFeatureCollection,{id:'cmt_recordings'});//this._lyrRecordingPoints.setVisibility(false);
this._lyrRecordingPoints.setRenderer(ren);on(this._lyrRecordingPoints,'click',this._clickRecordingPoint.bind(this));this.map.addLayer(this._lyrRecordingPoints);//measurement layer
var measureCollection={'layerDefinition':{'geometryType':'esriGeometryPoint','fields':[{'name':'id','alias':'ID','type':'esriFieldTypeOID'}]},'featureSet':null};var measureSymbol=new SimpleMarkerSymbol;measureSymbol.setStyle(SimpleMarkerSymbol.STYLE_CROSS);measureSymbol.setAngle(47);var measureRen=new SimpleRenderer(measureSymbol);this._measureLayer=new FeatureLayer(measureCollection,{id:'cmt_measure'});this._measureLayer.setRenderer(measureRen);this.map.addLayer(this._measureLayer);//Overlay layer
this._overlayLayer=new GraphicsLayer({id:'cmt_overlay'});this.map.addLayer(this._overlayLayer);// CameraIcon Layer
this._lyrCameraIcon=new GraphicsLayer({id:'cmt_cameraLayer'});this.map.addLayer(this._lyrCameraIcon);this.addEventListener(this._lyrCameraIcon,'mouse-down',function(){_this2._viewerOrientation()})},_displayFeatures:function _displayFeatures(){var self=this;var mapLayers=self.map._layers;var layerName=void 0;var overlaySrs=void 0;if(self.config.srs==='EPSG:28992'){overlaySrs=new SpatialReference({wkid:parseInt(self.config.srs.substr(5))})}else{overlaySrs=new SpatialReference({wkid:102100})}var featureLayStr='Feature Layer';var esriGeometryPointStr='esriGeometryPoint';var esriPolyLineStr='esriGeometryPolyline';var esriGeometryPolygonStr='esriGeometryPolygon';var markSymbol='simplemarkersymbol';var imageSymbol='picturemarkersymbol';var lineSymbol='simplelinesymbol';var esriLineSymbol='esriSLS';var esriPictureSymbol='esriPMS';var esriPolySymbol='esriSFS';var polygonSymbol='simplefillsymbol';for(var key in mapLayers){var featurePoints=[];var featureLines=[];var featurePolys=[];if(!mapLayers.hasOwnProperty(key)){continue}//if (mapLayers[key].type) {
var mapLayer=mapLayers[key];if(mapLayer.type===featureLayStr){layerName=mapLayer.name;var layerUrl=mapLayer.url;var layerSymbology=void 0;var methodParams={layerName:layerName,featurePoints:featurePoints,featureLines:featureLines,featurePolys:featurePolys,overlaySrs:overlaySrs,esriGeometryPointStr:esriGeometryPointStr,esriPolyLineStr:esriPolyLineStr,esriGeometryPolygonStr:esriGeometryPolygonStr,markSymbol:markSymbol,imageSymbol:imageSymbol,lineSymbol:lineSymbol,esriLineSymbol:esriLineSymbol,esriPictureSymbol:esriPictureSymbol,esriPolySymbol:esriPolySymbol,polygonSymbol:polygonSymbol,mapLayer:mapLayer,layerSymbology:layerSymbology};try{layerSymbology=mapLayer.renderer.getSymbol();methodParams.layerSymbology=layerSymbology;methodParams.uniqueStyling=false;this._layerSymbology(methodParams)}catch(err){layerSymbology=mapLayer.renderer.defaultSymbol;if(layerSymbology){methodParams.layerSymbology=layerSymbology;this._layerSymbology(methodParams)}else{layerSymbology={'color':{'r':223,'g':115,'b':255,'a':1},'size':11,'type':'simplemarkersymbol','style':'square','outline':{'color':{'r':26,'g':26,'b':26,'a':1},'width':2,'type':'simplelinesymbol','style':'solid'},'xoffset':0,'yoffset':0};methodParams.layerSymbology=layerSymbology;this._layerSymbology(methodParams)}}}}},_layerSymbology:function _layerSymbology(_ref){var layerName=_ref.layerName,featurePoints=_ref.featurePoints,featureLines=_ref.featureLines,featurePolys=_ref.featurePolys,overlaySrs=_ref.overlaySrs,esriGeometryPointStr=_ref.esriGeometryPointStr,esriPolyLineStr=_ref.esriPolyLineStr,esriGeometryPolygonStr=_ref.esriGeometryPolygonStr,markSymbol=_ref.markSymbol,imageSymbol=_ref.imageSymbol,lineSymbol=_ref.lineSymbol,esriLineSymbol=_ref.esriLineSymbol,esriPictureSymbol=_ref.esriPictureSymbol,esriPolySymbol=_ref.esriPolySymbol,polygonSymbol=_ref.polygonSymbol,mapLayer=_ref.mapLayer,layerSymbology=_ref.layerSymbology;var self=this;var sldName=mapLayer.name;var sldTitle=mapLayer.id;var fillColor=void 0;if(layerSymbology.color){try{fillColor=layerSymbology.color.toHex()}catch(err){var rgba=new Color.fromArray(layerSymbology.color);fillColor=rgba.toHex()}}var strokeColor=void 0,strokeWidth=void 0,imageType=void 0,imageUrl=void 0,imageSize=void 0,lineWidth=void 0,polygonLength=void 0;if(mapLayer.geometryType===esriGeometryPointStr){var symbolShape=void 0,pointStyling=void 0;if(layerSymbology.type===markSymbol){if(layerSymbology.outline){var toCovert=layerSymbology.outline.color;var arrayColor='rgba('+[toCovert.r,toCovert.g,toCovert.b,toCovert.a].toString()+')';strokeColor=this.rgbaToHex(arrayColor);strokeWidth=layerSymbology.outline.width;symbolShape=layerSymbology.style}}else if(layerSymbology.type===imageSymbol||esriPictureSymbol){imageType=layerSymbology.contentType;var imageDat=layerSymbology.imageData;var imageLink=layerSymbology.url;var imgDatValue=this._imageUrlValidation(imageDat);if(imgDatValue===false){imageUrl=imageLink;imageUrl=' \' '+imageUrl+' \' '}else{imageUrl=imageDat;imageUrl=' \' '+imageUrl+' \' '}console.log(imgDatValue);imageSize=layerSymbology.size;symbolShape='image'}//Here i read each point from the feature layer
dojoArray.forEach(mapLayer.graphics,function(pointFeature,i){var srsViewer=parseInt(self.config.srs.substr(5));var ptViewer=utils.transformProj4js(pointFeature.geometry,srsViewer);var ptCooridnate=[ptViewer.x,ptViewer.y];var properties={symbol:symbolShape};var featurePtViewer={'type':'Feature',properties:properties,'geometry':{'type':'Point','coordinates':ptCooridnate}};featurePoints.push(featurePtViewer)});//create a geojson here for the cyclorama
var featureGeoJSON={'type':'FeatureCollection','features':featurePoints};var overlayOptions=void 0;if(symbolShape){pointStyling=sldStyling.sldStylingPoints(fillColor,strokeColor,strokeWidth,symbolShape,sldName,sldTitle,imageType,imageUrl,imageSize,lineWidth,polygonLength);overlayOptions={name:layerName,geojson:featureGeoJSON,sourceSrs:self.config.srs,sldXMLtext:pointStyling}}else{overlayOptions={name:layerName,geojson:featureGeoJSON,sourceSrs:self.config.srs}}if(this.arrayOverlayIds[sldName]){StreetSmartApi.removeOverlay(this.arrayOverlayIds[sldName])}var overlay=StreetSmartApi.addOverlay(overlayOptions);console.log(overlay);self.arrayOverlayIds[sldName]=overlay.id}else if(mapLayer.geometryType===esriPolyLineStr){var symbolLine='line';var properties={symbol:symbolLine};dojoArray.forEach(mapLayer.graphics,function(pointFeature,i){var lineCoords=[];dojoArray.forEach(pointFeature.geometry.paths[0],function(featurePoint,i){var mapPt=new Point(featurePoint[0],featurePoint[1],overlaySrs);var srsViewer=parseInt(self.config.srs.substr(5));var ptViewer=utils.transformProj4js(mapPt,srsViewer);var lineCooridnate=[ptViewer.x,ptViewer.y];lineCoords.push(lineCooridnate)});var featureLineViewer={'type':'Feature',properties:properties,'geometry':{'type':'LineString','coordinates':lineCoords}};featureLines.push(featureLineViewer)});var _featureGeoJSON={'type':'FeatureCollection','features':featureLines};var _overlayOptions=void 0,lineStyling=void 0;if(layerSymbology.type===lineSymbol||esriLineSymbol){lineWidth=layerSymbology.width;lineStyling=sldStyling.sldStylingPoints(fillColor,strokeColor,strokeWidth,symbolLine,sldName,sldTitle,imageType,imageUrl,imageSize,lineWidth,polygonLength);console.log(symbolLine);console.log(lineStyling);_overlayOptions={name:layerName,geojson:_featureGeoJSON,sourceSrs:self.config.srs,sldXMLtext:lineStyling}}if(this.lineOverlayIds[sldName]){StreetSmartApi.removeOverlay(this.lineOverlayIds[sldName])}var _overlay=StreetSmartApi.addOverlay(_overlayOptions);console.log(_overlay);self.lineOverlayIds[sldName]=_overlay.id}else if(mapLayer.geometryType===esriGeometryPolygonStr){var symbolPoly='polygon';dojoArray.forEach(mapLayer.graphics,function(pointFeature,i){var polyCoords=[];var polyFeatureArray=pointFeature.geometry.rings[0];polygonLength=polyFeatureArray.length;dojoArray.forEach(polyFeatureArray,function(featurePoint,i){var mapPt=new Point(featurePoint[0],featurePoint[1],overlaySrs);var srsViewer=parseInt(self.config.srs.substr(5));var ptViewer=utils.transformProj4js(mapPt,srsViewer);var ptCooridnate=[ptViewer.x,ptViewer.y];polyCoords.push(ptCooridnate)});var properties={symbol:symbolPoly,polygonLength:polygonLength};var featurePolyViewer={'type':'Feature',properties:properties,'geometry':{'type':'Polygon','coordinates':[polyCoords]}};featurePolys.push(featurePolyViewer)});var _featureGeoJSON2={'type':'FeatureCollection','features':featurePolys};var _overlayOptions2=void 0,polyStyling=void 0;if(layerSymbology.type===polygonSymbol||esriPolySymbol){if(layerSymbology.outline){var outColor=layerSymbology.outline.color;var colorArray='rgba('+[outColor.r,outColor.g,outColor.b,outColor.a].toString()+')';strokeColor=this.rgbaToHex(colorArray);strokeWidth=layerSymbology.outline.width}polyStyling=sldStyling.sldStylingPoints(fillColor,strokeColor,strokeWidth,symbolPoly,sldName,sldTitle,imageType,imageUrl,imageSize,lineWidth,polygonLength);console.log(symbolPoly);console.log(polyStyling);_overlayOptions2={name:layerName,geojson:_featureGeoJSON2,sourceSrs:self.config.srs,sldXMLtext:polyStyling}}if(this.polyOverlayIds[sldName]){StreetSmartApi.removeOverlay(this.polyOverlayIds[sldName])}var _overlay2=StreetSmartApi.addOverlay(_overlayOptions2);console.log(_overlay2);self.polyOverlayIds[sldName]=_overlay2.id}},rgbaToHex:function rgbaToHex(rgb){rgb=rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);return rgb&&rgb.length===4?'#'+('0'+parseInt(rgb[1],10).toString(16)).slice(-2)+('0'+parseInt(rgb[2],10).toString(16)).slice(-2)+('0'+parseInt(rgb[3],10).toString(16)).slice(-2):''},_imageUrlValidation:function _imageUrlValidation(imageURL){var urlRegExp=new RegExp('^http(s?)://[0-9a-zA-Z]([-.w]*[0-9a-zA-Z])*(:(0-9)*)*(/?)([a-zA-Z0-9-.?,\'/\\+&amp;%$#_]*)?$');return urlRegExp.test(imageURL)},_loadRecordings:function _loadRecordings(){var _this3=this;if(this.map.getZoom()>this.mapZoomLevel&&this._recordingClient){var extent=this.map.extent;this._recordingClient.requestWithinBBOX(extent.xmin,extent.ymin,extent.xmax,extent.ymax,this.map.spatialReference.wkid).then(function(recordings){_this3._onRecordingLoadSuccess(recordings)}).catch(function(err){console.warn('RecordingLayer.recordingClient. Error: ',err)})}},_onRecordingLoadSuccess:function _onRecordingLoadSuccess(recordings){var graphics=[];for(var i=0;i<recordings.length;++i){var attributes={'recording_id':recordings[i].id};var geom=new Point(recordings[i].xyz[0],recordings[i].xyz[1],new SpatialReference({wkid:102100}));var symbol=null;var graphic=Graphic(geom,symbol,attributes,null);graphics.push(graphic)}// Clear graphics from layer
this._clearLayerGraphics(this._lyrRecordingPoints);// Add the new graphics to the layer.
this._addLayerGraphics(this._lyrRecordingPoints,graphics);this._lyrCameraIcon.setVisibility(true)},_clearLayerGraphics:function _clearLayerGraphics(layer){if(layer.graphics.length>0){layer.applyEdits(null,null,layer.graphics)}},_addLayerGraphics:function _addLayerGraphics(layer,graphics){if(layer&&graphics&&graphics.length>0){layer.applyEdits(graphics,null,null)}},_clickRecordingPoint:function _clickRecordingPoint(event){var ptId=event.graphic.attributes.recording_id;var self=this;StreetSmartApi.open(ptId,{viewerType:this.viewerType,srs:this.config.srs}).then(function(result){if(result&&result[0]){console.log('Opened a panorama viewer through API!',result[0]);if(self.config.navigation!==true){self._navigationDisabled()}}}).catch(function(reason){console.log('Error opening panorama viewer: '+reason)})},onOpen:function onOpen(){if(this.streetSmartInitiated===true){console.info('onOpen');var self=this;// Add extent change listener
if(!this._mapExtentChangeListener){this._mapExtentChangeListener=this.addEventListener(this.map,'extent-change',this._onExtentChanged.bind(this))}if(this.map.getZoom()>this.mapZoomLevel){domStyle.set('zoomWarningDiv','display','none');// If no recording loaded previously then use map center to open one.
if(StreetSmartApi.getApiReadyState()){var pt=this.map.extent.getCenter();var mapSRS=this.config.srs;var usableSRS=mapSRS.split(':');var ptLocal=utils.transformProj4js(pt,usableSRS[1]);StreetSmartApi.open(ptLocal.x+','+ptLocal.y,{viewerType:this.viewerType,srs:mapSRS}).then(function(result){console.log('Created component through API:',result);if(result){for(var i=0;i<result.length;i++){if(result[i].getType()===StreetSmartApi.ViewerType.PANORAMA)window.panoramaViewer=result[i]}this._panoramaViewer=window.panoramaViewer;this._addEventsToViewer();this._updateViewerGraphics(this._panoramaViewer,false);if(this.config.measurement!==true){var measureBtn=StreetSmartApi.PanoramaViewerUi.buttons.MEASURE;this._panoramaViewer.toggleButtonEnabled(measureBtn)}if(this.config.navigation!==true){this._navigationDisabled()}}}.bind(this)).catch(function(reason){console.log('Failed to create component(s) through API: '+reason)})}this._loadRecordings()}else{var showWarning=true;if(this._panoramaViewer&&this._panoramaViewer.getRecording()!==null){showWarning=false}if(showWarning){domStyle.set('zoomWarningDiv','display','block')}}}else{this.postCreate()}},_overlayButtonAdd:function _overlayButtonAdd(){var navbar=document.querySelector('.panoramaviewer .navbar');var nav=navbar.querySelector('.navbar-right .nav');var self=this;var btn=nav.querySelector('.btn');if(!nav.querySelector('#addGeoJsonBtn')){var addJsonBtn=dojo.create('button',{id:'addGeoJsonBtn',class:btn.className,onclick:function onclick(){self._jsonOverlay()}});var uploadJson=dojo.create('input',{id:'uploadJsonBtn',type:'file'});nav.appendChild(addJsonBtn);nav.appendChild(uploadJson);var btnJsonTip=dom.byId('addGeoJsonBtn');var toolTipMsg='Add a SHP or GeoJSON overlay';new Tooltip({connectId:btnJsonTip,label:toolTipMsg,position:['above']});self.JsonLayerButton=true}},onClose:function onClose(){console.info('onClose');var divView=this.panoramaViewerDiv;// Remove extent change listener.
this._mapExtentChangeListener=this.removeEventListener(this._mapExtentChangeListener);StreetSmartApi.destroy({targetElement:divView});// Remove Graphics from layers.
this._clearLayerGraphics(this._lyrRecordingPoints);this._lyrCameraIcon.setVisibility(false);this.streetSmartInitiated=false;this.map.removeLayer(this._measureLayer);this.map.removeLayer(this._lyrRecordingPoints);this.map.removeLayer(this._lyrCameraIcon);this._recordingColor=this._recordingColor.toHex()},_addEventsToViewer:function _addEventsToViewer(){var _this4=this;this.addEventListener(this._panoramaViewer,StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE,function(){_this4._updateViewerGraphics(_this4._panoramaViewer,false)});this.addEventListener(this._panoramaViewer,StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE,function(){_this4._updateViewerGraphics(_this4._panoramaViewer,false)});var navBar=document.getElementsByClassName('.navbar-menu');//navBar.addEventListener("click", this._overlayButtonAdd());
},_jsonOverlay:function _jsonOverlay(){var self=this;if(self.JsonLayerButton===true){var btnUpload=dom.byId('uploadJsonBtn');btnUpload.click();dojo.connect(btnUpload,'change',function(){var fileData=btnUpload.files[0];console.log(fileData);if(fileData.type==='application/zip'){var reader=new FileReader;reader.onload=function(e){console.log(reader.result);Shp(reader.result).then(function(geoJson){console.log(geoJson);var overlayPoints=[];var overlayGraphics=[];var responsePoints=void 0;var panoGeoJSON=void 0;if(geoJson.features[0].geometry.type==='LineString'||geoJson.features[0].geometry.type==='Polygon'&&geoJson.features[0].geometry.coordinates[0].length<3){responsePoints=geoJson.features[0].geometry.coordinates;panoGeoJSON=geoJson;dojoArray.forEach(responsePoints,function(respPoint,i){var ptX=respPoint[0];var ptY=respPoint[1];//points for overlay on the map
var mapPt=new Point(ptX,ptY,new SpatialReference({wkid:102100}));var polyPoint=[mapPt.x,mapPt.y];var pts=new Point(ptX,ptY,new SpatialReference({wkid:4326}));overlayGraphics.push(polyPoint)});if(geoJson.features[0].geometry.type==='LineString'){var lineJson={'paths':[overlayGraphics],'spatialReference':{'wkid':4326}};var line=new Polyline(lineJson);var polyFs=new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([152,194,60]),2),new Color([152,194,60,0.2]));//let polyGraphic = new Graphic(poly, fs);
self._overlayLayer.add(new Graphic(line,polyFs))}if(geoJson.features[0].geometry.type==='Polygon'){var polygonJson={'rings':[overlayGraphics],'spatialReference':{'wkid':4326}};var poly=new Polygon(polygonJson);var _polyFs=new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([152,194,60]),2),new Color([152,194,60,0.2]));//let polyGraphic = new Graphic(poly, fs);
self._overlayLayer.add(new Graphic(poly,_polyFs))}}else{responsePoints=geoJson.features[0].geometry.coordinates[0];dojoArray.forEach(responsePoints,function(respPoint,i){var ptX=respPoint[0];var ptY=respPoint[1];//points for overlay on the map
var mapPt=new Point(ptX,ptY,new SpatialReference({wkid:102100}));var polyPoint=[mapPt.x,mapPt.y];var pts=new Point(ptX,ptY,new SpatialReference({wkid:4326}));overlayGraphics.push(polyPoint);//points for overlay on the GeoCylorama
var srsParam=parseInt(self.config.srs.substr(5));var ptPano=utils.transformProj4js(pts,srsParam);var pointOverlay=[ptPano.x,ptPano.y];overlayPoints.push(pointOverlay)});//show the overlay on the map
var _polygonJson={'rings':[overlayGraphics],'spatialReference':{'wkid':4326}};var _poly=new Polygon(_polygonJson);var _polyFs2=new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([152,194,60]),2),new Color([152,194,60,0.2]));//let polyGraphic = new Graphic(poly, fs);
self._overlayLayer.add(new Graphic(_poly,_polyFs2));//show overlay on the GeoCyclorama
panoGeoJSON={'type':'FeatureCollection','features':[{'type':'Feature','properties':{},'geometry':{'type':geoJson.features[0].geometry.type,'coordinates':[overlayPoints]}}]}}StreetSmartApi.addOverlay(geoJson.fileName,panoGeoJSON,self.config.srs)})};reader.readAsArrayBuffer(fileData)}else{var _reader=new FileReader;_reader.onload=function(e){var res=_reader.result;var finalJson=JSON.parse(res);StreetSmartApi.addOverlay('New GeoJSON',finalJson,self.config.srs)};_reader.readAsText(fileData)}})}},_handleMeasurements:function _handleMeasurements(measurementEvent){var _this5=this;var self=this;console.log(this);if(measurementEvent&&measurementEvent.detail){var _measurementEvent$det=measurementEvent.detail,activeMeasurement=_measurementEvent$det.activeMeasurement,panoramaViewer=_measurementEvent$det.panoramaViewer;if(activeMeasurement){if(panoramaViewer&&self.measureChange===true){self._lyrCameraIcon.clear();self.addEventListener(panoramaViewer,StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE,function(){self._updateViewerGraphics(panoramaViewer,false)});self.addEventListener(panoramaViewer,StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE,function(){self._updateViewerGraphics(panoramaViewer,false)});self.measureChange=false}if(activeMeasurement.features[0].geometry.type==='Point'||activeMeasurement.features[0].geometry.type==='LineString'){var measurmentCoordinates=void 0;var coordinatesLength=void 0;if(activeMeasurement.features[0].geometry.type!=='Point'){measurmentCoordinates=activeMeasurement.features[0].geometry.coordinates;coordinatesLength=measurmentCoordinates.length}else if(activeMeasurement.features[0].geometry.type!=='LineString'){if(activeMeasurement.features[0].geometry.coordinates!==null){measurmentCoordinates=[activeMeasurement.features[0].geometry.coordinates]}}var measureLinePoints=[];dojoArray.forEach(measurmentCoordinates,function(coordMeasure,i){var pointX=coordMeasure[0];var pointY=coordMeasure[1];var pt=new Point(pointX,pointY,new SpatialReference({wkid:parseInt(self.config.srs.substr(5))}));var ptMap=utils.transformProj4js(pt,self.map.spatialReference.wkid);var measureGraphics=[];var geom=new Point(ptMap.x,ptMap.y,new SpatialReference({wkid:102100}));var symbol=null;var measureNumber=new TextSymbol;measureNumber.setText(i+1);measureNumber.setVerticalAlignment('top');measureNumber.setHorizontalAlignment('right');var measureGraphic=Graphic(geom,symbol,null);measureGraphics.push(measureGraphic);self._addLayerGraphics(self._measureLayer,measureGraphics);self.map.graphics.add(new Graphic(geom,measureNumber));if(coordinatesLength>1){var linePoints=[ptMap.x,ptMap.y];measureLinePoints.push(linePoints)}});if(coordinatesLength>1){console.log('measurepoints'+measureLinePoints);var polyJson={'paths':[measureLinePoints],'spatialReference':{wkid:102100}};var measureLines=new Polyline(polyJson);var symbol=new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([26,26,26,1]),2);self.map.graphics.add(new Graphic(measureLines,symbol));var x1=(measureLinePoints[coordinatesLength-2][0]+measureLinePoints[coordinatesLength-1][0])/2;var y1=(measureLinePoints[coordinatesLength-2][1]+measureLinePoints[coordinatesLength-1][1])/2;var lineLabelPoint=new Point(x1,y1,new SpatialReference({wkid:102100}));var value=parseFloat(activeMeasurement.features[0].properties.derivedData.totalLength.value).toFixed(2)+activeMeasurement.features[0].properties.derivedData.unit;var measureValue=new TextSymbol(value);measureValue.setVerticalAlignment('middle');measureValue.setHorizontalAlignment('right');self.map.graphics.add(new Graphic(lineLabelPoint,measureValue))}}if(activeMeasurement.features[0].geometry.type==='Polygon'){//console.log(activeMeasurement.features[0].geometry.coordinates);
var surfacePoints=[];var surfaceMeasurePoints=activeMeasurement.features[0].geometry.coordinates[0];var surfaceMeasureLength=surfaceMeasurePoints.length;if(surfaceMeasureLength>0){for(var i=1;i<surfaceMeasureLength;i++){var surfaceX=surfaceMeasurePoints[i][0];var surfaceY=surfaceMeasurePoints[i][1];var surfacePt=new Point(surfaceX,surfaceY,new SpatialReference({wkid:parseInt(self.config.srs.substr(5))}));var surfacePtMap=utils.transformProj4js(surfacePt,self.map.spatialReference.wkid);var surfaceGraphics=[];var surfaceGeom=new Point(surfacePtMap.x,surfacePtMap.y,new SpatialReference({wkid:102100}));var surfaceSymbol=null;var surfaceMeasureNumber=new TextSymbol;surfaceMeasureNumber.setText(i);surfaceMeasureNumber.setVerticalAlignment('top');surfaceMeasureNumber.setHorizontalAlignment('right');var surfaceMeasureGraphic=Graphic(surfaceGeom,surfaceSymbol,null);surfaceGraphics.push(surfaceMeasureGraphic);self._addLayerGraphics(self._measureLayer,surfaceGraphics);self.map.graphics.add(new Graphic(surfaceGeom,surfaceMeasureNumber));if(surfaceMeasureLength>1){var polyPoints=[surfacePtMap.x,surfacePtMap.y];surfacePoints.push(polyPoints)}}if(surfaceMeasureLength>2){console.log('measurepoints'+surfacePoints);var _polyJson={'rings':[surfacePoints],'spatialReference':{wkid:102100}};var surfaceMeasureLines=new Polygon(_polyJson);var polySymbol=new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,new Color([26,26,26,1]),2);self.map.graphics.add(new Graphic(surfaceMeasureLines,polySymbol));var _x=(surfacePoints[surfaceMeasureLength-3][0]+surfacePoints[surfaceMeasureLength-2][0])/2;var _y=(surfacePoints[surfaceMeasureLength-3][1]+surfacePoints[surfaceMeasureLength-2][1])/2;var _lineLabelPoint=new Point(_x,_y,new SpatialReference({wkid:102100}));var _value=parseFloat(activeMeasurement.features[0].properties.derivedData.segmentLengths.value[surfaceMeasureLength-3]).toFixed(2)+activeMeasurement.features[0].properties.derivedData.unit;var _measureValue=new TextSymbol(_value);_measureValue.setVerticalAlignment('middle');_measureValue.setHorizontalAlignment('right');self.map.graphics.add(new Graphic(_lineLabelPoint,_measureValue))}}}}else if(!activeMeasurement){self._clearLayerGraphics(self._measureLayer);self.map.graphics.clear();self._lyrCameraIcon.clear();self.measureChange=true;self.addEventListener(panoramaViewer,StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE,function(){self._updateViewerGraphics(panoramaViewer,false)});self.addEventListener(panoramaViewer,StreetSmartApi.Events.panoramaViewer.IMAGE_CHANGE,function(){self._updateViewerGraphics(panoramaViewer,false)});var nav=document.querySelector('.panoramaviewer .navbar .nav');if(nav!==null){self._overlayButtonAdd(nav);document.addEventListener('click',function(){setTimeout(function(){var expanded=document.querySelector('.panoramaviewer .viewer-navbar-expanded');if(expanded){_this5._overlayButtonAdd()}},250)},true)}}}},_updateViewerGraphics:function _updateViewerGraphics(currentViewer,extentchanged){var curViewer=currentViewer._viewer;if(!curViewer._activeRecording)return;var x=curViewer._activeRecording.xyz[0];var y=curViewer._activeRecording.xyz[1];if(x&&y){var pt=new Point(x,y,new SpatialReference({wkid:parseInt(curViewer._activeRecording.srs.substr(5))}));//Transform local SRS to Web Mercator:
var ptMap=utils.transformProj4js(pt,this.map.spatialReference.wkid);var yaw=curViewer.getYaw();var pitch=curViewer.getPitch();var hFov=curViewer.getHFov();var factor=50;var hhFov=hFov*0.5;var leftfovx=Math.sin(yaw-hhFov)*factor;var leftfovy=-Math.cos(yaw-hhFov)*factor;var rightfovx=Math.sin(yaw+hhFov)*factor;var rightfovy=-Math.cos(yaw+hhFov)*factor;var mapPt=new Point(ptMap.x,ptMap.y,this.map.spatialReference);var cPt=this.map.toScreen(mapPt);this._prePoint=mapPt;var a=this.map.toMap(new ScreenPoint(cPt.x,cPt.y));var b=this.map.toMap(new ScreenPoint(cPt.x+leftfovx,cPt.y+leftfovy));var c=this.map.toMap(new ScreenPoint(cPt.x+rightfovx,cPt.y+rightfovy));var d=this.map.toMap(new ScreenPoint(cPt.x,cPt.y));if(!curViewer.graLoc){var folderPath=this.folderUrl+'images/cam1.png';var ms=new PictureMarkerSymbol(folderPath,28,28);var marker=new Graphic(mapPt,ms);curViewer.graLoc=marker;this._lyrCameraIcon.add(marker)}else{curViewer.graLoc.setGeometry(mapPt)}var rot=yaw*180/Math.PI;curViewer.graLoc.symbol.setAngle(rot);if(curViewer.graFOV){this._lyrCameraIcon.remove(curViewer.graFOV)}var ls=new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL,new Color(0,0,0,1),2);var rgba=currentViewer.getViewerColor();rgba[3]=0.5;// set alpha
var fs=new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,ls,new Color.fromArray(rgba));var polygon=new Polygon(this.map.spatialReference);polygon.addRing([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y],[a.x,a.y]]);var graphic=new Graphic(polygon,fs);curViewer.graFOV=graphic;this._lyrCameraIcon.add(graphic);this._lyrCameraIcon.setVisibility(true)}},_viewerOrientation:function _viewerOrientation(){var _this6=this;this.map.disablePan();this.coneDrag=on(this.map,'mouse-drag',function(event){_this6._coneMoved(event)});this.coneDragEnd=on(this.map,'mouse-drag-end',function(){_this6._coneReleased()})},_coneMoved:function _coneMoved(event){var mapPt=event.mapPoint;var orientation=this._panoramaViewer.getOrientation();var currentPitch=orientation.pitch;var currentHFov=orientation.hFov;var angle=this._calcYaw(this._prePoint,mapPt);var rotAngle=angle*180/Math.PI;var orientationObj={yaw:rotAngle,pitch:currentPitch,hFov:currentHFov};this._panoramaViewer.setOrientation(orientationObj)},_coneReleased:function _coneReleased(){this.map.enablePan();this.coneDrag.remove();this.coneDragEnd.remove()},_calcYaw:function _calcYaw(pt1,pt2){var yDiff=pt2.y-pt1.y;var xDiff=pt2.x-pt1.x;var angle=Math.atan2(yDiff,xDiff)*180/Math.PI;var a=angle;if(angle>0&&angle<=90)a=90-angle;if(angle>90&&angle<=180)a=360-angle+90;if(angle<0)a=90-angle;var rad=a*Math.PI/180;return rad},_checkMapZoomLevel:function _checkMapZoomLevel(){var mapMaxZoom=this.map.getMaxZoom();var setMapZoom=void 0;if(mapMaxZoom>20){setMapZoom=mapMaxZoom-5}else{setMapZoom=mapMaxZoom-3}return setMapZoom},onMinimize:function onMinimize(){console.log('onMinimize')},// onMaximize: function(){
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
resize:function resize(){console.info('resize');// TODO NOT an official api function. will be in the next api release (v16.1+)!
// recalculate size for panoramaviewer when widget resizes.
//this._panoramaViewer._viewer.invalidateSize();
},//communication method between widgets
onReceiveData:function onReceiveData(name,widgetId,data,historyData){console.log(name,widgetId,data,historyData);if(name!=='Search'){return}var self=this;if(data.selectResult){var searchedPoint=data.selectResult.result.feature.geometry;var mapSRS=this.config.srs;var usableSRS=mapSRS.split(':');var searchedPtLocal=utils.transformProj4js(searchedPoint,usableSRS[1]);StreetSmartApi.open(searchedPtLocal.x+','+searchedPtLocal.y,{viewerType:this.viewerType,srs:this.config.srs}).then(function(result){if(result&&result[0]){console.log('Opened a panorama viewer through API!',result[0]);if(self.config.navigation!==true){self._navigationDisabled()}}}).catch(function(reason){console.log('Error opening panorama viewer: '+reason)})}},_navigationDisabled:function _navigationDisabled(){this._panoramaViewer.toggleRecordingsVisible();this._panoramaViewer.toggleNavbarVisible();this._panoramaViewer.toggleTimeTravelVisible()}})})});

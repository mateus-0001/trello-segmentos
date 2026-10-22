/* global TrelloPowerUp */
(function(){'use strict';
var config=window.SEGMENT_EXPORTER_CONFIG||{};
function openExporter(t){return t.modal({url:'./modal.html',title:'Segmentos & Excel',fullscreen:true,accentColor:'#2563EB'});}
var opts={appName:config.appName||'Segmentos & Excel',appAuthor:config.appAuthor||'Seu time'};
if(config.appKey && config.appKey!=='COLE_SUA_API_KEY_AQUI')opts.appKey=config.appKey;
TrelloPowerUp.initialize({'board-buttons':function(){return [{icon:{light:'./assets/icon-dark.svg',dark:'./assets/icon-light.svg'},text:'Segmentos & Excel',condition:'always',callback:openExporter}];}},opts);
})();

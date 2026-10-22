/* global TrelloPowerUp */
(function(){'use strict';
var config=window.SEGMENT_EXPORTER_CONFIG||{};
// Ícones e modal com URL absoluta (o Trello é mais confiável assim do que com caminho relativo).
function abs(path){return new URL(path,window.location.href).href;}
function openExporter(t){return t.modal({url:abs('./modal.html'),title:'Segmentos & Excel',fullscreen:true,accentColor:'#2563EB'});}
var opts={appName:config.appName||'Segmentos & Excel',appAuthor:config.appAuthor||'Seu time'};
if(config.appKey && config.appKey!=='COLE_SUA_API_KEY_AQUI')opts.appKey=config.appKey;
TrelloPowerUp.initialize({'board-buttons':function(){return [{icon:{light:abs('./assets/icon-dark.svg'),dark:abs('./assets/icon-light.svg')},text:'Segmentos & Excel',condition:'always',callback:openExporter}];}},opts);
})();

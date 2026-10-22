/* Pure helpers shared by the UI and tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BatchEngine=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
function buildNextLabels(existingIds, segmentIds, targetId){
  var segments=new Set(segmentIds);
  if(!segments.has(targetId)) throw new Error('A etiqueta de destino precisa ser um segmento configurado.');
  return Array.from(new Set((existingIds||[]).filter(function(id){return !segments.has(id);}).concat(targetId)));
}
return {buildNextLabels:buildNextLabels};
});

const assert=require('assert');
const {buildNextLabels}=require('../js/batch-engine.js');
assert.deepStrictEqual(buildNextLabels(['pago','vip','segmento-antigo'],['segmento-antigo','segmento-novo'],'segmento-novo'),['pago','vip','segmento-novo']);
assert.deepStrictEqual(buildNextLabels(['segmento-novo','pago'],['segmento-novo','segmento-antigo'],'segmento-novo'),['pago','segmento-novo']);
assert.throws(()=>buildNextLabels([],['seg-a'],'seg-b'));
console.log('✓ Testes de edição em lote passaram.');

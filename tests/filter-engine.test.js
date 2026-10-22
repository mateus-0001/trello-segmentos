const assert = require('assert');
const engine = require('../js/filter-engine.js');

const cards = [
  { id: '1', name: 'Cliente A', idList: 'l1', labels: [{ id: 'seg-a', name: 'Advocacia' }] },
  { id: '2', name: 'Cliente B', idList: 'l1', labels: [{ id: 'seg-b', name: 'Clínica' }, { id: 'vip', name: 'VIP' }] },
  { id: '3', name: 'Cliente C', idList: 'l2', labels: [] },
  { id: '4', name: 'Cliente D', idList: 'l2', labels: [{ id: 'seg-a' }, { id: 'seg-b' }] }
];

function ids(result) { return result.map(c => c.id); }

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  selectedSegmentIds: ['seg-a'], matchMode: 'hasAny'
})), ['1', '4']);

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  selectedSegmentIds: ['seg-a'], matchMode: 'hasNone'
})), ['2', '3']);

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  selectedSegmentIds: ['seg-a', 'seg-b'], matchMode: 'hasAll'
})), ['4']);

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  selectedSegmentIds: ['seg-a', 'seg-b'], matchMode: 'missingAny'
})), ['1', '2', '3']);

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  excludedLabelIds: ['vip']
})), ['1', '3', '4']);

assert.deepStrictEqual(ids(engine.filterCards(cards, {
  onlyWithoutAnyLabel: true
})), ['3']);

assert.strictEqual(engine.normalizeText('Clínica São João'), 'clinica sao joao');

console.log('✓ Todos os testes do filtro passaram.');

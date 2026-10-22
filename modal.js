/* global TrelloPowerUp, FilterEngine, ExportXLSX, BatchEngine */
(function () {
  'use strict';

  var config = window.SEGMENT_EXPORTER_CONFIG || {};
  var authOptions = {appName: config.appName || 'Segmentos & Excel', appAuthor: config.appAuthor || 'Seu time'};
  if (config.appKey && config.appKey !== 'COLE_SUA_API_KEY_AQUI') authOptions.appKey = config.appKey;
  var t = TrelloPowerUp.iframe(authOptions);
  var selectedCardIds = new Set();
  var batchBusy = false;
  var state = {
    board: null,
    cards: [],
    lists: [],
    labels: [],
    listById: {},
    filteredCards: [],
    filters: {
      selectedSegmentIds: [],
      excludedLabelIds: [],
      selectedListIds: [],
      matchMode: 'hasAny',
      textSearch: '',
      onlyWithoutAnyLabel: false,
      sortBy: 'listThenName'
    }
  };

  var els = {};
  var saveTimer = null;
  var initialized = false;

  function $(id) { return document.getElementById(id); }

  function cacheElements() {
    [
      'boardName', 'notice', 'refreshBtn', 'exportBtn', 'clearFiltersBtn',
      'totalCards', 'filteredCards', 'withSegment', 'withoutSegment',
      'textSearch', 'matchMode', 'modeHelp', 'segmentCount', 'excludeCount', 'listCount',
      'segmentLabelSearch', 'excludeLabelSearch', 'segmentLabels', 'excludeLabels',
      'listFilters', 'onlyWithoutAnyLabel', 'saveStatus', 'resultsSummary', 'sortBy',
      'resultsBody', 'emptyState', 'selectedCount', 'selectAll', 'selectVisibleBtn', 'deselectBtn', 'targetSegment', 'authorizeBtn', 'applyBatchBtn', 'batchStatus'
    ].forEach(function (id) { els[id] = $(id); });
  }

  function showNotice(message, type) {
    els.notice.textContent = message;
    els.notice.className = 'notice ' + (type || 'info');
  }

  function hideNotice() {
    els.notice.className = 'notice hidden';
    els.notice.textContent = '';
  }

  function labelDisplayName(label) {
    if (label.name && label.name.trim()) return label.name.trim();
    return 'Etiqueta sem nome · ' + (label.color || 'sem cor');
  }

  function makeLabelCheckbox(label, checked, kind) {
    var wrapper = document.createElement('label');
    wrapper.className = 'check-item';
    wrapper.dataset.search = FilterEngine.normalizeText(labelDisplayName(label));

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.value = label.id;
    input.checked = checked;
    input.dataset.kind = kind;

    var swatch = document.createElement('span');
    swatch.className = 'label-swatch';
    swatch.dataset.color = label.color || 'gray';

    var name = document.createElement('span');
    name.className = 'check-item-name';
    name.textContent = labelDisplayName(label);

    wrapper.appendChild(input);
    wrapper.appendChild(swatch);
    wrapper.appendChild(name);
    return wrapper;
  }

  function renderLabels() {
    renderTargetSegments();
    els.segmentLabels.innerHTML = '';
    els.excludeLabels.innerHTML = '';

    state.labels
      .slice()
      .sort(function (a, b) { return labelDisplayName(a).localeCompare(labelDisplayName(b), 'pt-BR', { sensitivity: 'base' }); })
      .forEach(function (label) {
        els.segmentLabels.appendChild(makeLabelCheckbox(
          label,
          state.filters.selectedSegmentIds.indexOf(label.id) !== -1,
          'segment'
        ));
        els.excludeLabels.appendChild(makeLabelCheckbox(
          label,
          state.filters.excludedLabelIds.indexOf(label.id) !== -1,
          'exclude'
        ));
      });

    if (!state.labels.length) {
      els.segmentLabels.innerHTML = '<p class="inline-empty">Este quadro não tem etiquetas.</p>';
      els.excludeLabels.innerHTML = '<p class="inline-empty">Este quadro não tem etiquetas.</p>';
    }
  }

  function renderTargetSegments() {
    var previous = els.targetSegment.value;
    els.targetSegment.innerHTML = '<option value="">Escolha um segmento…</option>';
    state.labels.filter(function (l) { return state.filters.selectedSegmentIds.includes(l.id); })
      .forEach(function (l) { var opt = document.createElement('option'); opt.value = l.id; opt.textContent = labelDisplayName(l); els.targetSegment.appendChild(opt); });
    if (state.filters.selectedSegmentIds.includes(previous)) els.targetSegment.value = previous;
    updateBatchControls();
  }

  function updateBatchControls() {
    if (!els.selectedCount) return;
    els.selectedCount.textContent = selectedCardIds.size + ' clientes selecionados';
    els.applyBatchBtn.disabled = batchBusy || !selectedCardIds.size || !els.targetSegment.value;
    els.authorizeBtn.disabled = batchBusy || !authOptions.appKey;
    els.selectVisibleBtn.disabled = batchBusy || !state.filteredCards.length;
    els.deselectBtn.disabled = batchBusy || !selectedCardIds.size;
    els.selectAll.checked = Boolean(state.filteredCards.length) && state.filteredCards.every(function(c) {return selectedCardIds.has(c.id);});
    els.selectAll.indeterminate = !els.selectAll.checked && state.filteredCards.some(function(c){return selectedCardIds.has(c.id);});
  }

  function setBatchStatus(message) { els.batchStatus.textContent = message; }

  function authorizeEdit() {
    if (!authOptions.appKey) { showNotice('Configure sua chave pública em js/config.js antes de autorizar.', 'error'); return Promise.resolve(null); }
    // Must originate from a click event so the browser permits the consent popup.
    return t.getRestApi().authorize({ scope: 'read,write', expiration: '30days' });
  }

  async function apiRequest(path, options, token) {
    var url = new URL('https://api.trello.com/1' + path);
    url.searchParams.set('key', authOptions.appKey);
    url.searchParams.set('token', token);
    var response = await fetch(url.toString(), options || {});
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + (await response.text()).slice(0, 140));
    return response.json();
  }

  async function applyBatch() {
    if (batchBusy) return;
    var target = els.targetSegment.value;
    var segments = state.filters.selectedSegmentIds.slice();
    if (!target || !segments.includes(target) || !selectedCardIds.size) return;
    var selected = Array.from(selectedCardIds);
    var label = state.labels.find(function(l){return l.id===target;});
    var name = label ? labelDisplayName(label) : 'o segmento escolhido';
    if (!window.confirm('Aplicar "' + name + '" em ' + selected.length + ' card(s)? As outras etiquetas de SEGMENTO serão substituídas. Etiquetas de pagamento/status serão mantidas.')) return;
    batchBusy = true;
    updateBatchControls();
    var changed = 0, failures = [];
    try {
      if (!authOptions.appKey) throw new Error('Preencha appKey em js/config.js e publique novamente.');
      var client = t.getRestApi();
      var token = await client.getToken();
      if (!token) throw new Error('Clique em “Autorizar edição” antes de aplicar alterações.');
      for (var i=0;i<selected.length;i++) {
        var cardId=selected[i];
        setBatchStatus('Atualizando ' + (i+1) + ' de ' + selected.length + '…');
        try {
          // Fresh read prevents overwriting unrelated labels added since page load.
          var current=await apiRequest('/cards/' + encodeURIComponent(cardId) + '?fields=idLabels', {}, token);
          var next=BatchEngine.buildNextLabels(current.idLabels||[],segments,target);
          if (next.slice().sort().join(',') !== (current.idLabels||[]).slice().sort().join(',')) {
            var body = new URLSearchParams(); body.set('idLabels',next.join(','));
            await apiRequest('/cards/' + encodeURIComponent(cardId), {method:'PUT',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},token);
          }
          changed++;
          selectedCardIds.delete(cardId);
        } catch(err) { failures.push(cardId + ': ' + err.message); }
      }
      setBatchStatus(changed + ' de ' + selected.length + ' cards processados. ' + (failures.length ? failures.length + ' falha(s).' : 'Tudo certo.'));
      if (failures.length) showNotice('Alguns cards falharam: ' + failures.slice(0,3).join(' | ') + (failures.length>3?'…':''), 'error');
      else showNotice('Segmento atualizado em ' + changed + ' card(s). Outras etiquetas preservadas.', 'success');
      await loadData({silent:true});
    } catch(err) { showNotice('Alteração não concluída: ' + err.message, 'error'); setBatchStatus(err.message); }
    finally { batchBusy=false; updateBatchControls(); }
  }

  function renderLists() {
    els.listFilters.innerHTML = '';
    state.lists.forEach(function (list) {
      var label = document.createElement('label');
      label.className = 'check-item simple';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = list.id;
      input.dataset.kind = 'list';
      input.checked = state.filters.selectedListIds.indexOf(list.id) !== -1;

      var name = document.createElement('span');
      name.className = 'check-item-name';
      name.textContent = list.name;

      label.appendChild(input);
      label.appendChild(name);
      els.listFilters.appendChild(label);
    });
  }

  function syncControlsFromState() {
    els.textSearch.value = state.filters.textSearch || '';
    els.matchMode.value = state.filters.matchMode || 'hasAny';
    els.onlyWithoutAnyLabel.checked = Boolean(state.filters.onlyWithoutAnyLabel);
    els.sortBy.value = state.filters.sortBy || 'listThenName';
    updateModeHelp();
  }

  function updateModeHelp() {
    var messages = {
      hasAny: 'Mostra cards que têm ao menos um dos segmentos escolhidos.',
      hasAll: 'Mostra somente cards que têm todos os segmentos escolhidos.',
      hasNone: 'Exceção: mostra cards que não têm nenhum dos segmentos escolhidos.',
      missingAny: 'Auditoria: mostra cards em que falta pelo menos um dos segmentos escolhidos.'
    };
    els.modeHelp.textContent = messages[els.matchMode.value] || '';
  }

  function readCheckboxes(kind) {
    return Array.prototype.slice.call(document.querySelectorAll('input[data-kind="' + kind + '"]:checked'))
      .map(function (input) { return input.value; });
  }

  function readFiltersFromControls() {
    state.filters.selectedSegmentIds = readCheckboxes('segment');
    state.filters.excludedLabelIds = readCheckboxes('exclude');
    state.filters.selectedListIds = readCheckboxes('list');
    state.filters.matchMode = els.matchMode.value;
    state.filters.textSearch = els.textSearch.value;
    state.filters.onlyWithoutAnyLabel = els.onlyWithoutAnyLabel.checked;
    state.filters.sortBy = els.sortBy.value;
  }

  function updateCounts() {
    var coverage = FilterEngine.countSegmentCoverage(state.cards, state.filters.selectedSegmentIds);
    els.totalCards.textContent = state.cards.length;
    els.filteredCards.textContent = state.filteredCards.length;
    els.withSegment.textContent = coverage.withSegment;
    els.withoutSegment.textContent = coverage.withoutSegment;
    els.segmentCount.textContent = state.filters.selectedSegmentIds.length;
    els.excludeCount.textContent = state.filters.excludedLabelIds.length;
    els.listCount.textContent = state.filters.selectedListIds.length;
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  function renderSegmentBadges(card) {
    var segments = FilterEngine.getSelectedSegments(card, state.filters.selectedSegmentIds);
    if (!segments.length) return '<span class="muted-badge">Sem segmento selecionado</span>';

    return segments.map(function (label) {
      var text = escapeHtml(labelDisplayName(label));
      var color = escapeHtml(label.color || 'gray');
      return '<span class="segment-badge" data-color="' + color + '">' + text + '</span>';
    }).join(' ');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderResults() {
    els.resultsBody.innerHTML = '';
    var fragment = document.createDocumentFragment();

    state.filteredCards.forEach(function (card) {
      var tr = document.createElement('tr');
      var listName = state.listById[card.idList] ? state.listById[card.idList].name : '—';
      var members = (card.members || []).map(function (member) {
        return member.fullName || member.username || '';
      }).filter(Boolean).join(', ') || '—';

      tr.innerHTML =
        '<td><div class="card-name">' + escapeHtml(card.name || '(sem nome)') + '</div>' +
        (card.desc ? '<div class="card-desc">' + escapeHtml(card.desc).slice(0, 180) + (card.desc.length > 180 ? '…' : '') + '</div>' : '') + '</td>' +
        '<td class="segments-cell">' + renderSegmentBadges(card) + '</td>' +
        '<td>' + escapeHtml(listName) + '</td>' +
        '<td>' + escapeHtml(members) + '</td>' +
        '<td class="nowrap">' + escapeHtml(formatDate(card.dateLastActivity)) + '</td>' +
        '<td class="action-cell"><a class="open-card" href="' + escapeHtml(card.url || '#') + '" target="_blank" rel="noopener noreferrer">Abrir card ↗</a></td>';
      fragment.appendChild(tr);
    });

    els.resultsBody.appendChild(fragment);
    updateBatchControls();
    els.emptyState.classList.toggle('hidden', state.filteredCards.length !== 0);
    els.exportBtn.disabled = state.filteredCards.length === 0;
    els.resultsSummary.textContent = state.filteredCards.length + ' de ' + state.cards.length + ' cards visíveis correspondem ao filtro atual.';
  }

  function applyFilters(options) {
    options = options || {};
    readFiltersFromControls();

    var filtered = FilterEngine.filterCards(state.cards, {
      selectedSegmentIds: state.filters.selectedSegmentIds,
      excludedLabelIds: state.filters.excludedLabelIds,
      selectedListIds: state.filters.selectedListIds,
      matchMode: state.filters.matchMode,
      textSearch: state.filters.textSearch,
      onlyWithoutAnyLabel: state.filters.onlyWithoutAnyLabel,
      listById: state.listById
    });

    state.filteredCards = FilterEngine.sortCards(filtered, state.filters.sortBy, state.listById);
    updateCounts();
    renderTargetSegments();
    renderResults();
    updateModeHelp();

    if (options.save !== false) scheduleSave();
  }

  function filterChecklist(container, searchValue) {
    var query = FilterEngine.normalizeText(searchValue);
    Array.prototype.slice.call(container.querySelectorAll('.check-item')).forEach(function (item) {
      item.classList.toggle('hidden', Boolean(query) && item.dataset.search.indexOf(query) === -1);
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    els.saveStatus.textContent = 'Salvando filtros…';
    saveTimer = setTimeout(function () {
      t.set('board', 'private', 'segmentExporterFilters', state.filters)
        .then(function () {
          els.saveStatus.textContent = 'Filtros salvos automaticamente neste quadro para você.';
        })
        .catch(function () {
          els.saveStatus.textContent = 'Não foi possível salvar os filtros, mas o filtro atual continua funcionando.';
        });
    }, 450);
  }

  function sanitizeSavedFilters(saved) {
    saved = saved || {};
    var labelIds = new Set(state.labels.map(function (label) { return label.id; }));
    var listIds = new Set(state.lists.map(function (list) { return list.id; }));
    var validModes = ['hasAny', 'hasAll', 'hasNone', 'missingAny'];
    var validSorts = ['listThenName', 'name', 'activityDesc', 'activityAsc'];

    return {
      selectedSegmentIds: (saved.selectedSegmentIds || []).filter(function (id) { return labelIds.has(id); }),
      excludedLabelIds: (saved.excludedLabelIds || []).filter(function (id) { return labelIds.has(id); }),
      selectedListIds: (saved.selectedListIds || []).filter(function (id) { return listIds.has(id); }),
      matchMode: validModes.indexOf(saved.matchMode) !== -1 ? saved.matchMode : 'hasAny',
      textSearch: saved.textSearch || '',
      onlyWithoutAnyLabel: Boolean(saved.onlyWithoutAnyLabel),
      sortBy: validSorts.indexOf(saved.sortBy) !== -1 ? saved.sortBy : 'listThenName'
    };
  }

  function loadData(options) {
    options = options || {};
    if (!options.silent) hideNotice();
    els.refreshBtn.disabled = true;
    els.exportBtn.disabled = true;
    els.refreshBtn.textContent = 'Atualizando…';

    return Promise.all([
      t.board('id', 'name', 'labels'),
      t.cards('id', 'name', 'desc', 'due', 'dueComplete', 'url', 'idList', 'members', 'labels', 'dateLastActivity'),
      t.lists('id', 'name'),
      t.get('board', 'private', 'segmentExporterFilters', {})
    ]).then(function (results) {
      state.board = results[0];
      state.cards = results[1] || [];
      state.lists = results[2] || [];
      state.labels = (state.board && state.board.labels) || [];
      state.listById = {};
      state.lists.forEach(function (list) { state.listById[list.id] = list; });
      state.filters = sanitizeSavedFilters(results[3]);

      els.boardName.textContent = state.board ? state.board.name : 'Quadro atual';
      renderLabels();
      renderLists();
      syncControlsFromState();
      applyFilters({ save: false });
      selectedCardIds = new Set(Array.from(selectedCardIds).filter(function(id) {return state.cards.some(function(c){return c.id===id;});}));
      renderResults();
      if (!options.silent) showNotice('Dados atualizados. Selecione vários clientes para aplicar um segmento ou exporte o Excel.', 'success');
    }).catch(function (error) {
      console.error(error);
      showNotice('Não foi possível ler os dados do quadro. Verifique se o Power-Up está habilitado neste quadro e recarregue o Trello.', 'error');
    }).finally(function () {
      els.refreshBtn.disabled = false;
      els.refreshBtn.textContent = 'Atualizar dados';
    });
  }

  function clearFilters() {
    state.filters = {
      selectedSegmentIds: [],
      excludedLabelIds: [],
      selectedListIds: [],
      matchMode: 'hasAny',
      textSearch: '',
      onlyWithoutAnyLabel: false,
      sortBy: 'listThenName'
    };
    renderLabels();
    renderLists();
    syncControlsFromState();
    applyFilters();
  }

  async function exportCurrent() {
    try {
      var labelsById = {};
      state.labels.forEach(function (label) { labelsById[label.id] = label; });
      var listsById = {};
      state.lists.forEach(function (list) { listsById[list.id] = list; });

      var filename = await ExportXLSX.exportWorkbook({
        boardName: state.board ? state.board.name : 'quadro',
        cards: state.filteredCards,
        totalVisible: state.cards.length,
        listById: state.listById,
        selectedSegmentIds: state.filters.selectedSegmentIds,
        selectedSegmentLabels: state.filters.selectedSegmentIds.map(function (id) { return labelsById[id]; }).filter(Boolean),
        excludedLabels: state.filters.excludedLabelIds.map(function (id) { return labelsById[id]; }).filter(Boolean),
        selectedLists: state.filters.selectedListIds.map(function (id) { return listsById[id]; }).filter(Boolean),
        matchMode: state.filters.matchMode,
        textSearch: state.filters.textSearch,
        onlyWithoutAnyLabel: state.filters.onlyWithoutAnyLabel
      });
      showNotice('Excel gerado: ' + filename, 'success');
    } catch (error) {
      console.error(error);
      showNotice(error.message || 'Não foi possível gerar o Excel.', 'error');
    }
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', function(){loadData();});
    els.authorizeBtn.addEventListener('click', function(){authorizeEdit().then(function(){setBatchStatus('Autorização concedida. Você pode editar os cards selecionados.');}).catch(function(e){showNotice('Autorização cancelada ou indisponível: ' + e.message, 'error');});});
    els.applyBatchBtn.addEventListener('click', applyBatch);
    els.targetSegment.addEventListener('change', updateBatchControls);
    els.selectVisibleBtn.addEventListener('click', function(){state.filteredCards.forEach(function(c){selectedCardIds.add(c.id);});renderResults();});
    els.deselectBtn.addEventListener('click', function(){selectedCardIds.clear();renderResults();});
    els.selectAll.addEventListener('change', function(){state.filteredCards.forEach(function(c){if(els.selectAll.checked)selectedCardIds.add(c.id);else selectedCardIds.delete(c.id);});renderResults();});
    els.resultsBody.addEventListener('change', function(e){if(e.target.matches('.card-selector')){if(e.target.checked)selectedCardIds.add(e.target.dataset.cardId);else selectedCardIds.delete(e.target.dataset.cardId);updateBatchControls();}});
    els.exportBtn.addEventListener('click', exportCurrent);
    els.clearFiltersBtn.addEventListener('click', clearFilters);

    ['change', 'input'].forEach(function (eventName) {
      els.textSearch.addEventListener(eventName, applyFilters);
    });
    els.matchMode.addEventListener('change', applyFilters);
    els.onlyWithoutAnyLabel.addEventListener('change', applyFilters);
    els.sortBy.addEventListener('change', applyFilters);

    [els.segmentLabels, els.excludeLabels, els.listFilters].forEach(function (container) {
      container.addEventListener('change', function (event) {
        if (event.target.matches('input[type="checkbox"]')) applyFilters();
      });
    });

    els.segmentLabelSearch.addEventListener('input', function () {
      filterChecklist(els.segmentLabels, els.segmentLabelSearch.value);
    });
    els.excludeLabelSearch.addEventListener('input', function () {
      filterChecklist(els.excludeLabels, els.excludeLabelSearch.value);
    });
  }

  t.render(function () {
    if (!initialized) {
      cacheElements();
      bindEvents();
      initialized = true;
      return loadData();
    }
    return Promise.resolve();
  });
})();

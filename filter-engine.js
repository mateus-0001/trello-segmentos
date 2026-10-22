(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FilterEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function getCardLabelIds(card) {
    return (card.labels || []).map(function (label) { return label.id; });
  }

  function intersects(a, b) {
    var lookup = new Set(a);
    return b.some(function (item) { return lookup.has(item); });
  }

  function includesAll(haystack, needles) {
    var lookup = new Set(haystack);
    return needles.every(function (item) { return lookup.has(item); });
  }

  function matchesSegmentMode(cardLabelIds, selectedSegmentIds, mode) {
    if (!selectedSegmentIds.length) return true;

    switch (mode) {
      case 'hasAll':
        return includesAll(cardLabelIds, selectedSegmentIds);
      case 'hasNone':
        return !intersects(cardLabelIds, selectedSegmentIds);
      case 'missingAny':
        return !includesAll(cardLabelIds, selectedSegmentIds);
      case 'hasAny':
      default:
        return intersects(cardLabelIds, selectedSegmentIds);
    }
  }

  function searchableCardText(card, listName) {
    var members = (card.members || []).map(function (member) {
      return [member.fullName, member.username].filter(Boolean).join(' ');
    }).join(' ');

    return normalizeText([
      card.name,
      card.desc,
      listName,
      members
    ].join(' '));
  }

  function filterCards(cards, options) {
    options = options || {};
    var selectedSegmentIds = options.selectedSegmentIds || [];
    var excludedLabelIds = options.excludedLabelIds || [];
    var selectedListIds = options.selectedListIds || [];
    var matchMode = options.matchMode || 'hasAny';
    var textSearch = normalizeText(options.textSearch || '');
    var onlyWithoutAnyLabel = Boolean(options.onlyWithoutAnyLabel);
    var listById = options.listById || {};

    return (cards || []).filter(function (card) {
      var labelIds = getCardLabelIds(card);

      if (onlyWithoutAnyLabel && labelIds.length > 0) return false;
      if (excludedLabelIds.length && intersects(labelIds, excludedLabelIds)) return false;
      if (selectedListIds.length && selectedListIds.indexOf(card.idList) === -1) return false;
      if (!matchesSegmentMode(labelIds, selectedSegmentIds, matchMode)) return false;

      if (textSearch) {
        var listName = listById[card.idList] ? listById[card.idList].name : '';
        if (searchableCardText(card, listName).indexOf(textSearch) === -1) return false;
      }

      return true;
    });
  }

  function getSelectedSegments(card, selectedSegmentIds) {
    var selected = new Set(selectedSegmentIds || []);
    return (card.labels || []).filter(function (label) {
      return selected.has(label.id);
    });
  }

  function countSegmentCoverage(cards, selectedSegmentIds) {
    var withSegment = 0;
    var withoutSegment = 0;

    (cards || []).forEach(function (card) {
      if (getSelectedSegments(card, selectedSegmentIds).length) withSegment += 1;
      else withoutSegment += 1;
    });

    return { withSegment: withSegment, withoutSegment: withoutSegment };
  }

  function sortCards(cards, sortBy, listById) {
    var copy = (cards || []).slice();
    listById = listById || {};

    function byName(a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
    }

    if (sortBy === 'name') return copy.sort(byName);

    if (sortBy === 'activityDesc' || sortBy === 'activityAsc') {
      var direction = sortBy === 'activityDesc' ? -1 : 1;
      return copy.sort(function (a, b) {
        var da = a.dateLastActivity ? new Date(a.dateLastActivity).getTime() : 0;
        var db = b.dateLastActivity ? new Date(b.dateLastActivity).getTime() : 0;
        if (da === db) return byName(a, b);
        return (da - db) * direction;
      });
    }

    return copy.sort(function (a, b) {
      var la = listById[a.idList] ? listById[a.idList].name : '';
      var lb = listById[b.idList] ? listById[b.idList].name : '';
      var listCompare = la.localeCompare(lb, 'pt-BR', { sensitivity: 'base' });
      return listCompare || byName(a, b);
    });
  }

  return {
    normalizeText: normalizeText,
    filterCards: filterCards,
    getSelectedSegments: getSelectedSegments,
    countSegmentCoverage: countSegmentCoverage,
    sortCards: sortCards,
    matchesSegmentMode: matchesSegmentMode
  };
});

(function () {
  function normalize(state) {
    const source = state || {};
    return {
      tariffRevision: String(source.tariffRevision || ''),
      performanceRevisions: Object.assign({}, source.performanceRevisions || {}),
      vehiclesRevision: String(source.vehiclesRevision || ''),
      garageRevision: String(source.garageRevision || '')
    };
  }

  function comparable(state, includeGarage) {
    const normalized = normalize(state);
    const performanceKeys = Object.keys(normalized.performanceRevisions).sort();

    return JSON.stringify({
      tariffRevision: normalized.tariffRevision,
      performanceRevisions: performanceKeys.reduce((result, key) => {
        result[key] = normalized.performanceRevisions[key];
        return result;
      }, {}),
      vehiclesRevision: normalized.vehiclesRevision,
      garageRevision: includeGarage ? normalized.garageRevision : ''
    });
  }

  function matches(cachedState, currentState, includeGarage) {
    if (!cachedState || !currentState) return false;
    return comparable(cachedState, includeGarage) === comparable(currentState, includeGarage);
  }

  async function fetchState() {
    return api('getRcpRevisionState');
  }

  window.RcpRevisions = Object.freeze({ matches, fetch: fetchState });
})();

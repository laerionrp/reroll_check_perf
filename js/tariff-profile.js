(function () {
  const STORAGE_KEY = 'rcp_tariff_scope_v1';
  const scopes = ['LS', 'BC'];
  let resolvedDefaultScope = '';
  function storedScope() {
    const value = localStorage.getItem(STORAGE_KEY);
    return scopes.includes(value) ? value : '';
  }
  function get() {
    return storedScope() || resolvedDefaultScope;
  }
  function getRequestScope() {
    return storedScope();
  }
  function resolve(scope) {
    if (storedScope()) return;
    const normalizedScope = String(scope || '').trim().toUpperCase();
    if (!scopes.includes(normalizedScope)) return;
    resolvedDefaultScope = normalizedScope;
    render();
  }
  function set(value) {
    const scope = scopes.includes(value) ? value : 'LS';
    localStorage.setItem(STORAGE_KEY, scope);
    render();
    window.dispatchEvent(new CustomEvent('rcp:tariff-scope-change', { detail: { scope } }));
  }
  function render() {
    const activeScope = get() || 'LS';
    document.querySelectorAll('[data-tariff-selector]').forEach(container => {
      container.querySelectorAll('button').forEach(button => {
        const active = button.dataset.scope === activeScope;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    });
  }
  function mount() {
    document.querySelectorAll('[data-app-navigation]').forEach(nav => {
      if (nav.querySelector('[data-tariff-selector]')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'tariff-selector';
      wrapper.dataset.tariffSelector = '';
      wrapper.setAttribute('aria-label', 'Profil LS Customs');
      wrapper.innerHTML = '<span>LS Customs</span><div><button type="button" data-scope="LS">LS</button><button type="button" data-scope="BC">BC</button></div>';
      wrapper.addEventListener('click', event => {
        const button = event.target.closest('button[data-scope]');
        if (button) set(button.dataset.scope);
      });
      nav.appendChild(wrapper);
    });
    render();
  }
  window.RcpTariff = Object.freeze({ get, getRequestScope, resolve, set, mount });
  mount();
})();

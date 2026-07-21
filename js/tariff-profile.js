(function () {
  const STORAGE_KEY = 'rcp_tariff_scope_v1';
  const scopes = ['LS', 'BC'];
  function get() {
    const value = localStorage.getItem(STORAGE_KEY);
    return scopes.includes(value) ? value : 'LS';
  }
  function set(value) {
    const scope = scopes.includes(value) ? value : 'LS';
    localStorage.setItem(STORAGE_KEY, scope);
    render();
    window.dispatchEvent(new CustomEvent('rcp:tariff-scope-change', { detail: { scope } }));
  }
  function render() {
    document.querySelectorAll('[data-tariff-selector]').forEach(container => {
      container.querySelectorAll('button').forEach(button => {
        const active = button.dataset.scope === get();
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
  window.RcpTariff = Object.freeze({ get, set, mount });
  mount();
})();

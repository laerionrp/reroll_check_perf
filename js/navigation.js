const RCP_NAV_ITEMS = Object.freeze([
  {
    id: 'control',
    label: 'Contrôle tarif',
    href: 'index.html'
  },
  {
    id: 'inventory',
    label: 'Inventaire',
    href: 'garage.html'
  },
  {
    id: 'settings',
    label: 'Paramètres',
    href: 'settings.html'
  }
]);

function getActiveNavigationPage(container) {
  const requestedPage = new URLSearchParams(window.location.search).get('target');

  if (
    document.body.classList.contains('login-page') &&
    RCP_NAV_ITEMS.some(item => item.id === requestedPage)
  ) {
    return requestedPage;
  }

  return container.dataset.activePage || '';
}

function renderAppNavigation() {
  document.querySelectorAll('[data-app-navigation]').forEach(container => {
    if (container.querySelector('[data-app-navigation-item]')) return;

    const activePage = getActiveNavigationPage(container);
    const navigationTail = container.querySelector('[data-navigation-tail], [data-tariff-selector]');
    const fragment = document.createDocumentFragment();

    RCP_NAV_ITEMS.forEach(item => {
      const link = document.createElement('a');
      const active = item.id === activePage;

      link.className = `tab${active ? ' active' : ''}`;
      link.href = item.href;
      link.textContent = item.label;
      link.dataset.appNavigationItem = item.id;

      if (active) {
        link.setAttribute('aria-current', 'page');
      }

      fragment.appendChild(link);
    });

    container.insertBefore(fragment, navigationTail || null);
  });
}

renderAppNavigation();
if (window.RcpTariff) window.RcpTariff.mount();

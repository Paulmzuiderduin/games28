export function parseRoute(pathname) {
  if (!pathname || pathname === '/') {
    return { name: 'home' };
  }

  if (pathname === '/schedule') {
    return { name: 'schedule' };
  }

  if (pathname === '/changes') {
    return { name: 'changes' };
  }

  const countryMatch = pathname.match(/^\/countries\/([A-Za-z0-9-]+)$/);
  if (countryMatch) {
    return {
      name: 'country',
      noc: countryMatch[1].toUpperCase()
    };
  }

  return { name: 'not-found' };
}

export function navigate(path, options = {}) {
  const method = options.replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

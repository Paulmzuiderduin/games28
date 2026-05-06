export function parseRoute(pathname) {
  if (!pathname || pathname === '/') {
    return { name: 'home' };
  }

  if (pathname === '/schedule') {
    return { name: 'schedule' };
  }

  if (pathname === '/countries') {
    return { name: 'countries' };
  }

  if (pathname === '/changes') {
    return { name: 'changes' };
  }

  const sportMatch = pathname.match(/^\/sports\/([A-Za-z0-9-]+)$/);
  if (sportMatch) {
    return {
      name: 'sport',
      sportSlug: sportMatch[1].toLowerCase()
    };
  }

  const sessionMatch = pathname.match(/^\/sessions\/([A-Za-z0-9-]+)$/);
  if (sessionMatch) {
    return {
      name: 'session',
      sessionId: decodeURIComponent(sessionMatch[1])
    };
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

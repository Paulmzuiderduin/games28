export function parseRoute(pathname) {
  const normalizedPath = normalizePathname(pathname);

  if (!normalizedPath || normalizedPath === '/') {
    return { name: 'home' };
  }

  if (normalizedPath === '/schedule') {
    return { name: 'schedule' };
  }

  if (normalizedPath === '/countries') {
    return { name: 'countries' };
  }

  if (normalizedPath === '/changes') {
    return { name: 'changes' };
  }

  const sportMatch = normalizedPath.match(/^\/sports\/([A-Za-z0-9-]+)\/?$/);
  if (sportMatch) {
    return {
      name: 'sport',
      sportSlug: sportMatch[1].toLowerCase()
    };
  }

  const sessionMatch = normalizedPath.match(/^\/sessions\/([A-Za-z0-9-]+)\/?$/);
  if (sessionMatch) {
    return {
      name: 'session',
      sessionId: decodeURIComponent(sessionMatch[1])
    };
  }

  const countryMatch = normalizedPath.match(/^\/countries\/([A-Za-z0-9-]+)\/?$/);
  if (countryMatch) {
    return {
      name: 'country',
      noc: countryMatch[1].toUpperCase()
    };
  }

  return { name: 'not-found' };
}

function normalizePathname(pathname) {
  if (!pathname) {
    return '/';
  }

  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '') || '/';
}

export function navigate(path, options = {}) {
  const method = options.replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

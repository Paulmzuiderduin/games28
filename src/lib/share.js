function currentPageUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.href;
}

export function getShareUrl(path = '') {
  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path || window.location.href, window.location.origin).href;
}

export async function sharePage({ title, text, url = currentPageUrl() } = {}, browser = globalThis) {
  const navigatorApi = browser?.navigator;
  const payload = { title, text, url };

  if (typeof navigatorApi?.share === 'function') {
    try {
      await navigatorApi.share(payload);
      return { status: 'shared', method: 'native' };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { status: 'cancelled', method: 'native' };
      }
    }
  }

  if (typeof navigatorApi?.clipboard?.writeText === 'function' && url) {
    try {
      await navigatorApi.clipboard.writeText(url);
      return { status: 'shared', method: 'copy' };
    } catch (error) {
      // A browser may expose Clipboard but deny access outside a secure gesture.
    }
  }

  return { status: 'unavailable', method: null };
}

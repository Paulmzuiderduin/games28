export function trackEvent(name, data = {}) {
  if (typeof window === 'undefined' || !name) {
    return;
  }

  try {
    if (typeof window.umami?.track === 'function') {
      window.umami.track(name, data);
    }
  } catch (error) {
    console.warn('Unable to track analytics event.', error);
  }
}

export function trackOutboundClick(name, url, data = {}) {
  trackEvent(name, {
    ...data,
    url
  });
}

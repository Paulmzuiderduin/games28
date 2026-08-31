const ANALYTICS_DISABLED_KEY = 'games28-analytics-disabled';
const UMAMI_SCRIPT_ID = 'games28-umami-script';
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = 'fa9fc201-00fd-427f-883e-a51dd6c45e09';

export function isAnalyticsDisabled() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(ANALYTICS_DISABLED_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

export function setAnalyticsDisabled(disabled) {
  if (typeof window === 'undefined') return;

  try {
    if (disabled) {
      window.localStorage.setItem(ANALYTICS_DISABLED_KEY, 'true');
      return;
    }

    window.localStorage.removeItem(ANALYTICS_DISABLED_KEY);
    initializeAnalytics();
  } catch (error) {
    console.warn('Unable to update analytics preference.', error);
  }
}

export function initializeAnalytics() {
  if (typeof document === 'undefined' || isAnalyticsDisabled() || document.getElementById(UMAMI_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = UMAMI_SCRIPT_ID;
  script.defer = true;
  script.src = UMAMI_SCRIPT_URL;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  document.head.appendChild(script);
}

export function trackEvent(name, data = {}) {
  if (typeof window === 'undefined' || !name || isAnalyticsDisabled()) {
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

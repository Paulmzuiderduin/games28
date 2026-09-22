import { useEffect, useRef } from 'react';
import { trackEvent } from '../lib/analytics.js';

export default function useCountrySearchNoResults(searchText, resultCount, location) {
  const lastTrackedQuery = useRef('');

  useEffect(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query || resultCount > 0) {
      lastTrackedQuery.current = '';
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (lastTrackedQuery.current === query) return;
      // Keep the searched text private; the aggregate event is enough to spot a discovery problem.
      trackEvent('country_search_no_results', { location });
      lastTrackedQuery.current = query;
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [location, resultCount, searchText]);
}

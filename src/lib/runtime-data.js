const DATA_BASE_URL = import.meta.env.VITE_DATA_BASE_URL || '';

function withDataBaseUrl(path) {
  if (!DATA_BASE_URL) {
    return path;
  }

  if (DATA_BASE_URL.endsWith('/')) {
    return `${DATA_BASE_URL.slice(0, -1)}${path}`;
  }

  return `${DATA_BASE_URL}${path}`;
}

export const RUNTIME_URL = withDataBaseUrl('/runtime.json');
export const RUNTIME_META_URL = withDataBaseUrl('/runtime.meta.json');
export const runtimeFallback = {
  generatedAt: null,
  checkedAt: null,
  version: 1,
  sources: [],
  countries: [],
  athleteCards: [],
  scheduleEntries: [],
  changes: [],
  meta: {
    communityReferenceCount: 0,
    countryCount: 0,
    flagPack: 'flag-icons',
    officialCandidateCount: 0,
    officialEventPdfUrl: null,
    scheduleCount: 0,
    officialSessionPdfUrl: null,
    officialSourceVersion: null,
    officialPdfHash: null,
    officialValidation: { passed: false, issues: [], metrics: {} },
    officialShadowSuccessStreak: 0,
    qualificationCount: 0,
    sportCount: 0,
    hasSecondaryScheduleSource: false,
    officialPageUrl: null,
    communityScheduleUrl: null,
    scheduleAuthority: 'community_reference',
    lastChangedAt: null,
    refreshCadence: 'Daily',
    shadowMode: true,
    staleWarning: null
  }
};

export async function loadRuntimeDataset() {
  try {
    const response = await fetch(RUNTIME_URL, {
      headers: {
        'cache-control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Runtime dataset request failed with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Falling back to empty runtime dataset.', error);
    return runtimeFallback;
  }
}

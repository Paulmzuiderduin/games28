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
  countrySelectionRegistry: [],
  qualificationSystems: [],
  qualificationRecords: [],
  qualificationHistory: [],
  qualificationReviewQueue: [],
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
    qualificationRecordCount: 0,
    qualificationHistoryCount: 0,
    qualificationRejectedCount: 0,
    qualificationReviewCount: 0,
    qualificationAutoRecordCount: 0,
    qualificationSourceScanCount: 0,
    qualificationPolicy: 'confirmation_only',
    qualificationCoverage: {
      coveredSportCount: 0,
      missingSports: [],
      systemCount: 0,
      configuredSystemCount: 0
    },
    countrySelectionCoverage: {
      countryCount: 0,
      configuredCount: 0,
      awaitingEndpointCount: 0
    },
    qualificationSources: [],
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

function isPublishableQualificationCard(card) {
  return !(card?.subjectType === 'team' && card?.state === 'allocated');
}

function protectPublicQualificationCards(runtime) {
  return {
    ...runtime,
    athleteCards: (runtime.athleteCards || []).filter(isPublishableQualificationCard)
  };
}

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

    return protectPublicQualificationCards(await response.json());
  } catch (error) {
    console.warn('Falling back to empty runtime dataset.', error);
    return runtimeFallback;
  }
}

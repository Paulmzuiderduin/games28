function pick(value, keys) {
  return Object.fromEntries(keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]));
}

const SOURCE_KEYS = 'id qualificationSystemKey label governingBody sport sports qualificationEvents sourceTier kind status url rulesUrl iocDocuments allocationUrl entryUrl refreshPolicy checkedAt available httpStatus resolvedUrl lastSuccessfulAt healthCheckFailedAt'.split(' ');
const CARD_KEYS = 'id noc name sport disciplines canonicalEventKey canonicalEventLabel scheduleHints status teamType subjectType state quotaCount teamSizeMax qualificationRoute sourceId sourceTier sourcePublishedAt verifiedAt allocationRecordId lastUpdatedAt sourceUrl profileUrl'.split(' ');
const META_KEYS = 'communityReferenceCount communityScheduleUrl countryCount flagPack hasSecondaryScheduleSource lastChangedAt officialCandidateCount officialEventPdfUrl officialPageUrl officialPdfHash officialSessionPdfUrl officialSourceVersion officialValidation officialShadowSuccessStreak qualificationCount qualificationRecordCount qualificationHistoryCount qualificationRejectedCount qualificationReviewCount qualificationAutoRecordCount qualificationSourceScanCount qualificationPolicy iocQualificationRules qualificationCoverage countrySelectionCoverage refreshCadence scheduleAuthority scheduleCount shadowMode sportCount staleWarning'.split(' ');

// Public output is deliberately constructed rather than copied from admin/runtime state.
export function publicRuntime(runtime) {
  return {
    ...pick(runtime, ['version', 'generatedAt', 'checkedAt', 'countries', 'scheduleEntries', 'changes']),
    sources: (runtime.sources || []).map((source) => pick(source, 'id kind label description url checkedAt fallbackUsed'.split(' '))),
    countrySelectionRegistry: (runtime.countrySelectionRegistry || []).map((source) => pick(source, ['noc', 'countryName', 'status', 'officialNocUrl', 'nocAuthorityUrl'])),
    athleteCards: (runtime.athleteCards || []).map((card) => pick(card, CARD_KEYS)),
    meta: {
      ...pick(runtime.meta, META_KEYS),
      qualificationSources: (runtime.meta?.qualificationSources || []).map((source) => pick(source, SOURCE_KEYS))
    }
  };
}

export function publicIngestion(ingestion) {
  return {
    checkedAt: ingestion.checkedAt,
    scans: (ingestion.scans || []).map((scan) => pick(scan, ['sourceId', 'checkedAt', 'format', 'rowCount', 'structuredRecordCount', 'truncated'])),
    reviewCount: (ingestion.reviewQueue || []).length
  };
}

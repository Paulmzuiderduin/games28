import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRuntime, publicIngestion } from '../../scripts/public-dataset.mjs';

test('public datasets never copy review evidence, history, suggestions or private notes', () => {
  const secret = 'PRIVATE-EVIDENCE-SENTINEL';
  const runtime = {
    version: 2, checkedAt: '2026-09-07', countries: [], scheduleEntries: [], changes: [],
    qualificationReviewQueue: [{ extractedEvidence: secret }],
    qualificationHistory: [{ notes: secret }], qualificationRecords: [{ notes: secret }],
    countrySelectionRegistry: [{ noc: 'NED', status: 'configured', selectionSources: [{ evidenceTerms: [secret] }] }],
    athleteCards: [{ id: 'approved', name: 'Public Name', notes: secret }],
    meta: { qualificationSources: [{ id: 'if-test', suggestedRecord: { notes: secret } }], privateField: secret }
  };
  const output = publicRuntime(runtime);
  assert.equal(output.athleteCards[0].name, 'Public Name');
  assert.equal(JSON.stringify(output).includes(secret), false);
  assert.equal('qualificationReviewQueue' in output, false);
  assert.equal(JSON.stringify(publicIngestion({ reviewQueue: [{ extractedEvidence: secret }], rejected: [secret] })).includes(secret), false);
});

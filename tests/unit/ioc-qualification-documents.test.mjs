import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIocQualificationRulesIndex, getAllIocQualificationDocuments, getIocQualificationDocuments } from '../../scripts/ioc-qualification-documents.mjs';
import { qualificationSystems } from '../../scripts/qualification-systems.mjs';

test('maps IOC qualification PDFs to their qualification-system groups', () => {
  const documents = getAllIocQualificationDocuments(qualificationSystems);
  const missing = qualificationSystems.filter((system) => !getIocQualificationDocuments(system.key).length).map((system) => system.key);

  assert.equal(documents.length, 52);
  assert.equal(new Set(documents.map((entry) => entry.qualificationSystemKey)).size, 35);
  assert.deepEqual(missing, ['athletics', 'football']);
  assert.equal(documents.every((entry) => entry.url.startsWith('https://stillmed.olympics.com/')), true);
});

test('keeps sport-specific IOC rules separate inside multi-discipline systems', () => {
  const volleyball = getIocQualificationDocuments('volleyball');

  assert.deepEqual(volleyball.find((entry) => entry.id === 'ioc-beach-volleyball').sports, ['Beach Volleyball']);
  assert.deepEqual(volleyball.find((entry) => entry.id === 'ioc-volleyball').sports, ['Volleyball']);
});

test('builds a versioned official-document index from IOC publication metadata', () => {
  const system = qualificationSystems.find((entry) => entry.key === 'archery');
  const result = buildIocQualificationRulesIndex({
    systems: [system],
    checkedAt: '2026-09-05T10:00:00.000Z'
  });

  assert.equal(result.listedDocumentCount, 1);
  assert.equal(result.documents[0].availability, 'listed_by_ioc');
  assert.equal(result.documents[0].sourceVersion, 'ioc-published-2026-05-12');
  assert.deepEqual(result.waitingSystems, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { officialCheckStatus } from '../../src/lib/source-status.js';

test('published official source does not show an obsolete promotion counter', () => {
  const result = officialCheckStatus({ scheduleAuthority: 'official_pdf', officialValidation: { passed: true }, officialShadowSuccessStreak: 23 });
  assert.equal(result.value, 'Passed');
  assert.doesNotMatch(result.detail, /23|of 3|before switching/);
});
test('stale official schedule is explicit even if the saved PDF parses successfully', () => {
  assert.equal(officialCheckStatus({ scheduleAuthority: 'stale_official', officialValidation: { passed: true } }).value, 'Using last good schedule');
});
test('shadow validation and failures explain the currently published state', () => {
  assert.match(officialCheckStatus({ scheduleAuthority: 'community_reference', officialValidation: { passed: true }, officialShadowSuccessStreak: 2 }).detail, /2 of 3/);
  assert.equal(officialCheckStatus({}).value, 'Needs review');
  assert.equal(officialCheckStatus({ officialValidation: { passed: false, issues: ['Missing rows'] } }).detail, 'Missing rows');
});

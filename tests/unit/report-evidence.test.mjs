import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReportEvidenceUrl } from '../../src/lib/report-evidence.js';

const source = { url: 'https://www.fei.org', allocationUrl: 'https://data.fei.org/allocations' };
test('keeps the exact submitted official article rather than replacing it with the homepage', () => {
  assert.equal(resolveReportEvidenceUrl({ source_url: 'https://www.fei.org/story/qualification?event=team' }, source), 'https://www.fei.org/story/qualification?event=team');
});
test('allows an admin to replace a third-party lead with the matching official evidence', () => {
  assert.equal(resolveReportEvidenceUrl({ source_url: 'https://unofficial.example/story' }, source, 'https://data.fei.org/allocations/team'), 'https://data.fei.org/allocations/team');
});
test('rejects unsafe URLs, unmatched hosts and silent homepage fallbacks', () => {
  for (const source_url of ['', 'javascript:alert(1)', 'http://www.fei.org/story', 'https://fei.org.attacker.example/story', 'https://user:secret@www.fei.org/story']) {
    assert.throws(() => resolveReportEvidenceUrl({ source_url }, source));
  }
});

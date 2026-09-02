import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestQualificationSources } from '../../scripts/qualification-ingestion.mjs';

const countries = [{ noc: 'NED', name: 'Netherlands' }, { noc: 'USA', name: 'United States' }];
const source = {
  id: 'if-example',
  url: 'https://if.example.org/allocations',
  sourceTier: 'if',
  sport: 'Example Sport',
  status: 'structured_live'
};

function response(body, contentType = 'text/html') {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

test('auto-publishes only complete structured official allocation rows', async () => {
  const result = await ingestQualificationSources({
    sources: [source],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response(`
      <table><tr><th>NOC</th><th>Quota places</th><th>Status</th><th>Qualification date</th></tr>
      <tr><td>NED</td><td>2</td><td>Allocated</td><td>2028-01-01</td></tr></table>
    `)
  });

  assert.equal(result.sourceChecks[0].available, true);
  assert.equal(result.structuredRecords.length, 1);
  assert.equal(result.structuredRecords[0].noc, 'NED');
  assert.equal(result.structuredRecords[0].state, 'allocated');
  assert.equal(result.structuredRecords[0].quotaCount, 2);
});

test('keeps a structured record ID stable when an official table is reordered', async () => {
  const sourceRows = (rows) => ingestQualificationSources({
    sources: [source],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response(`<table><tr><th>NOC</th><th>Quota places</th><th>Status</th><th>Qualification date</th></tr>${rows}</table>`)
  });
  const netherlands = '<tr><td>NED</td><td>2</td><td>Allocated</td><td>2028-01-01</td></tr>';
  const usa = '<tr><td>USA</td><td>1</td><td>Allocated</td><td>2028-01-01</td></tr>';
  const first = await sourceRows(`${netherlands}${usa}`);
  const second = await sourceRows(`${usa}${netherlands}`);

  assert.equal(first.structuredRecords.find((record) => record.noc === 'NED').id, second.structuredRecords.find((record) => record.noc === 'NED').id);
});

test('does not publish incomplete tables or unknown NOCs', async () => {
  const result = await ingestQualificationSources({
    sources: [source],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response(`
      <table><tr><th>NOC</th><th>Quota places</th><th>Status</th></tr>
      <tr><td>XXX</td><td>2</td><td>Allocated</td></tr></table>
    `)
  });

  assert.equal(result.structuredRecords.length, 0);
});

test('maps a full official country name to its IOC NOC code', async () => {
  const result = await ingestQualificationSources({
    sources: [source],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response(`
      <table><tr><th>Country</th><th>Quota places</th><th>Status</th><th>Qualification date</th></tr>
      <tr><td>Netherlands</td><td>1</td><td>Allocated</td><td>2028-01-01</td></tr></table>
    `)
  });

  assert.equal(result.structuredRecords[0].noc, 'NED');
});

test('creates a stable pending candidate for designated official prose sources', async () => {
  const result = await ingestQualificationSources({
    sources: [{ ...source, id: 'if-prose', status: 'review_required' }],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response('<article><p>The federation confirmed the Olympic qualification selection pathway.</p></article>')
  });

  assert.equal(result.structuredRecords.length, 0);
  assert.equal(result.reviewQueue.length, 1);
  assert.match(result.reviewQueue[0].reason, /human approval/i);
});

test('pre-fills, but does not publish, configured official confirmation articles', async () => {
  const result = await ingestQualificationSources({
    sources: [{
      ...source,
      id: 'if-official-article',
      status: 'review_required',
      adapter: 'official_confirmation_article',
      evidenceTerms: ['first teams', 'LA28'],
      sourcePublishedAt: '2028-01-01',
      confirmationCandidates: [{
        noc: 'NED',
        sport: 'Example Sport',
        discipline: 'Example discipline',
        subjectType: 'team',
        teamName: 'Netherlands example team',
        state: 'allocated',
        evidenceTerms: ['Netherlands', 'qualified']
      }]
    }],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response('<article><script>ignore this qualification text</script><p>The first teams qualified for LA28: Netherlands.</p></article>')
  });

  assert.equal(result.structuredRecords.length, 0);
  assert.equal(result.reviewQueue.length, 1);
  assert.equal(result.reviewQueue[0].suggestedRecord.noc, 'NED');
  assert.equal(result.reviewQueue[0].suggestedRecord.teamName, 'Netherlands example team');
  assert.doesNotMatch(result.reviewQueue[0].extractedEvidence, /ignore this/i);
});

test('preserves an unnamed team allocation without treating it as a selected roster', async () => {
  const result = await ingestQualificationSources({
    sources: [{
      ...source,
      id: 'if-team-allocation',
      status: 'review_required',
      adapter: 'official_confirmation_article',
      evidenceTerms: ['team quota', 'LA28'],
      sourcePublishedAt: '2028-01-01',
      confirmationCandidates: [{
        noc: 'NED',
        sport: 'Example Sport',
        discipline: 'Example team event',
        subjectType: 'team_quota',
        quotaCount: 1,
        teamSizeMax: 3,
        state: 'allocated',
        evidenceTerms: ['Netherlands', 'qualified']
      }]
    }],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response('<article><p>LA28 team quota: Netherlands qualified.</p></article>')
  });

  const record = result.reviewQueue[0].suggestedRecord;
  assert.equal(record.subjectType, 'team_quota');
  assert.equal(record.quotaCount, 1);
  assert.equal(record.teamSizeMax, 3);
  assert.equal(record.teamName, null);
});

test('uses the ISSF quota tracker only when its table explicitly names LA28', async () => {
  const result = await ingestQualificationSources({
    sources: [{ ...source, id: 'if-shooting', sport: 'Shooting', adapter: 'issf_quota_tracker' }],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async (url) => {
      if (url === 'https://if.example.org/allocations') {
        return response('<a href="/la28-quota-places">LA28 quota places by nation</a>');
      }
      return response(`
        <time datetime="2028-01-01"></time><h1>LA28 Quota Places by Nation</h1>
        <table><tr><th>NOC</th><th>Quota places</th></tr><tr><td>NED</td><td>2</td></tr></table>
      `);
    }
  });

  assert.equal(result.structuredRecords.length, 1);
  assert.equal(result.structuredRecords[0].noc, 'NED');
  assert.equal(result.structuredRecords[0].state, 'allocated');
  assert.equal(result.scans[0].adapter.eligible, true);
});

test('does not use a stale non-LA28 ISSF tracker even when its table looks valid', async () => {
  const result = await ingestQualificationSources({
    sources: [{ ...source, id: 'if-shooting', sport: 'Shooting', adapter: 'issf_quota_tracker' }],
    countries,
    checkedAt: '2028-01-02T00:00:00.000Z',
    fetchImpl: async () => response('<table><tr><th>NOC</th><th>Quota places</th></tr><tr><td>NED</td><td>2</td></tr></table>')
  });

  assert.equal(result.structuredRecords.length, 0);
  assert.equal(result.scans[0].adapter.eligible, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  detectSourceVersion,
  extractOfficialPdfUrl,
  extractOfficialSessionPdfUrl
} from '../../scripts/update-data.mjs';

const page = await readFile(new URL('../../src/data/official-page.html', import.meta.url), 'utf8');

test('official page discovery keeps the event and session PDFs on the same live version', () => {
  const eventUrl = extractOfficialPdfUrl(page);
  const sessionUrl = extractOfficialSessionPdfUrl(page);
  assert.match(eventUrl, /ByEventV4\.0\.pdf$/);
  assert.match(sessionUrl, /BySessionV4\.0\.pdf$/);
  assert.equal(detectSourceVersion(eventUrl, Buffer.from('')), 'V4.0');
});

test('source versions never keep the dot before the .pdf extension', () => {
  assert.equal(
    detectSourceVersion('https://example.test/LA28OlympicGamesCompetitionScheduleByEventV12.3.pdf', Buffer.from('')),
    'V12.3'
  );
  assert.equal(detectSourceVersion('https://example.test/no-version.pdf', Buffer.from('Version 5.1')), 'V5.1');
  assert.equal(detectSourceVersion('https://example.test/no-version.pdf', Buffer.from('nothing')), 'UNKNOWN');
});

test('missing official links fall back to the canonical current PDFs', () => {
  assert.match(extractOfficialPdfUrl('<html>blocked</html>'), /ByEventV4\.0\.pdf$/);
  assert.match(extractOfficialSessionPdfUrl('<html>blocked</html>'), /BySessionV4\.0\.pdf$/);
});

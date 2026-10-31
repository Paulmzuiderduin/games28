import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { qualificationSupersessionLinks } from '../../scripts/qualification-records.mjs';
const run = promisify(execFile);
function assertRetained(original, next) {
  const { supersededIds } = qualificationSupersessionLinks(next.qualificationHistory);
  for (const previous of original.qualificationRecords) {
    assert.ok(
      next.qualificationHistory.some((row) => row.id === previous.id),
      `Lost history ${previous.id}`
    );
    assert.ok(
      next.qualificationRecords.some((row) => row.id === previous.id) || supersededIds.has(previous.id),
      `Lost qualification ${previous.id}`
    );
  }
}
const root = fileURLToPath(new URL('../../', import.meta.url));

test(
  'complete offline refresh preserves publication and approved records, including after PDF corruption',
  { timeout: 60000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'games28-refresh-test-'));
    try {
      await cp(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
      await cp(join(root, 'src'), join(dir, 'src'), { recursive: true });
      await cp(join(root, 'package.json'), join(dir, 'package.json'));
      await symlink(join(root, 'node_modules'), join(dir, 'node_modules'));
      await writeFile(
        join(dir, 'offline.mjs'),
        "globalThis.fetch = async () => { throw new Error('Simulated offline'); };\n"
      );
      const json = async (name) => JSON.parse(await readFile(join(dir, 'src/data', name), 'utf8'));
      const original = await json('runtime.json');
      const env = { ...process.env, GAMES28_SOURCE_FETCH_ATTEMPTS: '1' };
      delete env.SUPABASE_URL;
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      const refresh = async () =>
        run(process.execPath, ['--import', join(dir, 'offline.mjs'), 'scripts/update-data.mjs'], {
          cwd: dir,
          env,
          maxBuffer: 1024 * 1024,
          timeout: 25000
        });
      await refresh();
      const offline = await json('runtime.json');
      assert.equal(offline.meta.scheduleAuthority, 'stale_official');
      assert.deepEqual(offline.scheduleEntries, original.scheduleEntries);
      assert.equal(offline.meta.officialShadowSuccessStreak, 0);
      assertRetained(original, offline);
      const cachedCandidate = await readFile(join(dir, 'src/data/schedule-official-candidate.json'), 'utf8');
      assert.ok(JSON.parse(cachedCandidate).length > 0);
      await writeFile(join(dir, 'src/data/official-schedule-by-event.snapshot.pdf'), 'invalid PDF');
      await refresh();
      const broken = await json('runtime.json');
      assert.equal(broken.meta.scheduleAuthority, 'stale_official');
      assert.equal(broken.meta.officialValidation.passed, false);
      assert.deepEqual(broken.scheduleEntries, original.scheduleEntries);
      assert.equal(await readFile(join(dir, 'src/data/schedule-official-candidate.json'), 'utf8'), cachedCandidate);
      assert.ok((await json('source-check.json')).officialParserError);
      assertRetained(original, broken);
      await cp(
        join(root, 'src/data/official-schedule-by-event.snapshot.pdf'),
        join(dir, 'src/data/official-schedule-by-event.snapshot.pdf')
      );
      await writeFile(
        join(dir, 'offline.mjs'),
        `
      import { readFile } from 'node:fs/promises';
      globalThis.fetch = async (url) => {
        const address = String(url);
        const file = address.includes('CompetitionScheduleByEvent') ? 'official-schedule-by-event.snapshot.pdf'
          : address.includes('la28.org/en/games-plan/olympics.html') ? 'official-page.html'
          : address.includes('docs.google.com/spreadsheets/') ? 'community-schedule.csv' : null;
        if (!file) throw new Error('Simulated unavailable qualification source');
        return new Response(await readFile(new URL('./src/data/' + file, import.meta.url)), { status: 200 });
      };
    `
      );
      await refresh();
      const recovered = await json('runtime.json');
      assert.equal(recovered.meta.scheduleAuthority, 'official_pdf');
      assert.equal(recovered.meta.officialValidation.passed, true);
      assert.equal(recovered.meta.staleWarning, null);
      assert.equal(recovered.scheduleEntries.filter((row) => row.sessionCode === 'ARC03').length, 5);
      assertRetained(original, recovered);

      const goodPageSnapshot = await readFile(join(dir, 'src/data/official-page.html'));
      const goodPdfSnapshot = await readFile(join(dir, 'src/data/official-schedule-by-event.snapshot.pdf'));
      await writeFile(
        join(dir, 'offline.mjs'),
        `
      import { readFile } from 'node:fs/promises';
      globalThis.fetch = async (url) => {
        const address = String(url);
        if (address.includes('la28.org/en/games-plan/olympics.html')) {
          return new Response('<html><body>Access denied</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
        }
        if (address.includes('CompetitionScheduleByEvent')) {
          return new Response('<html><body>Not a PDF</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
        }
        if (address.includes('docs.google.com/spreadsheets/')) {
          return new Response(await readFile(new URL('./src/data/community-schedule.csv', import.meta.url)), { status: 200 });
        }
        throw new Error('Simulated unavailable qualification source');
      };
    `
      );
      await refresh();
      const poisoned = await json('runtime.json');
      assert.equal(poisoned.meta.scheduleAuthority, 'stale_official');
      assert.equal(poisoned.meta.officialValidation.passed, false);
      assert.deepEqual(poisoned.scheduleEntries, recovered.scheduleEntries);
      assert.ok(
        (await readFile(join(dir, 'src/data/official-page.html'))).equals(goodPageSnapshot),
        'a challenge page must not replace the good page snapshot'
      );
      assert.ok(
        (await readFile(join(dir, 'src/data/official-schedule-by-event.snapshot.pdf'))).equals(goodPdfSnapshot),
        'invalid 200 responses must not replace the good PDF snapshot'
      );
      assertRetained(original, poisoned);

      await writeFile(
        join(dir, 'src/data/schedule-entry-lists.source.json'),
        JSON.stringify({
          entries: [
            {
              id: 'qa-draw-arc03',
              sessionCode: 'ARC03',
              nocs: ['NED'],
              publishedAt: '2026-10-30T00:00:00.000Z',
              sourceUrl: 'https://official.example/draws/arc03'
            }
          ]
        })
      );
      await refresh();
      const withDraw = await json('runtime.json');
      assert.equal(withDraw.meta.entryListAppliedCount, 5);
      assert.equal(
        withDraw.scheduleEntries.filter((row) => row.sessionCode === 'ARC03').every((row) => row.nocs.includes('NED')),
        true
      );
      assertRetained(original, withDraw);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
);

test(
  'a parsed candidate that fails validation cannot block the last-good schedule through coverage',
  { timeout: 60000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'games28-coverage-test-'));
    try {
      await cp(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
      await cp(join(root, 'src'), join(dir, 'src'), { recursive: true });
      await cp(join(root, 'package.json'), join(dir, 'package.json'));
      await symlink(join(root, 'node_modules'), join(dir, 'node_modules'));
      await writeFile(
        join(dir, 'scripts/official-pdf-parser.mjs'),
        `
      export async function parseOfficialSchedulePdf() {
        return [{
          id: 'fake-coverage-row',
          sport: 'Swimming',
          eventName: 'Fake Final',
          sessionCode: 'SWM01',
          dateLabel: 'Monday, July 10',
          dayKey: '2028-07-10',
          startAtUtc: null,
          endAtUtc: null,
          venue: 'Fake Venue',
          status: 'scheduled',
          sourceUrl: 'https://example.test/schedule'
        }];
      }
      export async function extractPdfPageLines() { return []; }
      export function parseScheduleEntriesFromPageLines() { return []; }
    `
      );
      await writeFile(
        join(dir, 'offline.mjs'),
        "globalThis.fetch = async () => { throw new Error('Simulated offline'); };\n"
      );
      const original = JSON.parse(await readFile(join(dir, 'src/data/runtime.json'), 'utf8'));
      const env = { ...process.env, GAMES28_SOURCE_FETCH_ATTEMPTS: '1' };
      delete env.SUPABASE_URL;
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      await run(process.execPath, ['--import', join(dir, 'offline.mjs'), 'scripts/update-data.mjs'], {
        cwd: dir,
        env,
        maxBuffer: 1024 * 1024,
        timeout: 25000
      });
      const next = JSON.parse(await readFile(join(dir, 'src/data/runtime.json'), 'utf8'));
      assert.equal(next.meta.scheduleAuthority, 'stale_official');
      assert.equal(next.meta.officialValidation.passed, false);
      assert.deepEqual(next.scheduleEntries, original.scheduleEntries);
      assert.ok(next.meta.qualificationCoverage.missingSports.length === 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
);

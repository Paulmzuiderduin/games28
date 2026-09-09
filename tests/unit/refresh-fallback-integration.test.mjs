import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));

test('complete offline refresh preserves publication and approved records, including after PDF corruption', { timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'games28-refresh-test-'));
  try {
    await cp(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
    await cp(join(root, 'src'), join(dir, 'src'), { recursive: true });
    await cp(join(root, 'package.json'), join(dir, 'package.json'));
    await symlink(join(root, 'node_modules'), join(dir, 'node_modules'));
    await writeFile(join(dir, 'offline.mjs'), "globalThis.fetch = async () => { throw new Error('Simulated offline'); };\n");
    const json = async (name) => JSON.parse(await readFile(join(dir, 'src/data', name), 'utf8'));
    const original = await json('runtime.json');
    const env = { ...process.env };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const refresh = async () => run(process.execPath, ['--import', join(dir, 'offline.mjs'), 'scripts/update-data.mjs'], { cwd: dir, env, maxBuffer: 1024 * 1024, timeout: 25000 });
    await refresh();
    const offline = await json('runtime.json');
    assert.equal(offline.meta.scheduleAuthority, 'stale_official');
    assert.deepEqual(offline.scheduleEntries, original.scheduleEntries);
    assert.equal(offline.meta.officialShadowSuccessStreak, 0);
    for (const previous of original.qualificationRecords) assert.ok(offline.qualificationRecords.some((row) => row.id === previous.id), `Lost qualification ${previous.id}`);
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
    for (const previous of original.qualificationRecords) assert.ok(broken.qualificationRecords.some((row) => row.id === previous.id), `Lost qualification ${previous.id}`);
    await cp(join(root, 'src/data/official-schedule-by-event.snapshot.pdf'), join(dir, 'src/data/official-schedule-by-event.snapshot.pdf'));
    await writeFile(join(dir, 'offline.mjs'), `
      import { readFile } from 'node:fs/promises';
      globalThis.fetch = async (url) => {
        const address = String(url);
        const file = address.includes('CompetitionScheduleByEvent') ? 'official-schedule-by-event.snapshot.pdf'
          : address.includes('la28.org/en/games-plan/olympics.html') ? 'official-page.html'
          : address.includes('docs.google.com/spreadsheets/') ? 'community-schedule.csv' : null;
        if (!file) throw new Error('Simulated unavailable qualification source');
        return new Response(await readFile(new URL('./src/data/' + file, import.meta.url)), { status: 200 });
      };
    `);
    await refresh();
    const recovered = await json('runtime.json');
    assert.equal(recovered.meta.scheduleAuthority, 'official_pdf');
    assert.equal(recovered.meta.officialValidation.passed, true);
    assert.equal(recovered.meta.staleWarning, null);
    assert.equal(recovered.scheduleEntries.filter((row) => row.sessionCode === 'ARC03').length, 5);
    for (const previous of original.qualificationRecords) assert.ok(recovered.qualificationRecords.some((row) => row.id === previous.id), `Lost qualification ${previous.id}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

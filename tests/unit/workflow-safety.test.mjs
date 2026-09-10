import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('deploy and refresh use lockfile installs and run tests before consequential steps', async () => {
  for (const name of ['pages','update-data']) {
    const workflow = await readFile(new URL(`../../.github/workflows/${name}.yml`,import.meta.url),'utf8');
    assert.match(workflow,/run: npm ci\b/);
    assert.doesNotMatch(workflow,/run: npm install/);
    const testAt=workflow.indexOf('run: npm run test:unit');
    assert.ok(testAt>0);
    assert.ok(testAt<workflow.indexOf(name==='pages'?'      - name: Build app':'      - name: Protect resolved'));
  }
});
test('an unpublished refresh fails visibly, while no changes remains a success', async () => {
  const workflow=await readFile(new URL('../../.github/workflows/update-data.yml',import.meta.url),'utf8');
  assert.match(workflow,/No data changes[\s\S]*?exit 0/);
  assert.match(workflow,/::error::[^\n]*rebase conflict[\s\S]*?exit 1/);
  assert.match(workflow,/::error::[^\n]*push failed[\s\S]*?exit 1/);
});

test('quota guard sync runs after refresh and before publication', async () => {
  const { readFile } = await import('node:fs/promises');
  const workflow = await readFile(new URL('../../.github/workflows/update-data.yml', import.meta.url), 'utf8');
  assert.ok(workflow.indexOf('npm run data:update') < workflow.indexOf('node scripts/sync-quota-guard.mjs'));
  assert.ok(workflow.indexOf('node scripts/sync-quota-guard.mjs') < workflow.indexOf('git push'));
});

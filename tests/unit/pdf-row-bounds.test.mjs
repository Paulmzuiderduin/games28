import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractRowSeparators, rowBoundsAt } from '../../scripts/pdf-row-bounds.mjs';

test('official table borders isolate the five ARC03 descriptions from adjacent sessions', async () => {
  const task = getDocument({ data: new Uint8Array(readFileSync(new URL('../../src/data/official-schedule-by-event.snapshot.pdf', import.meta.url))) });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const bounds = rowBoundsAt(112.89, extractRowSeparators(await page.getOperatorList()));
    assert.ok(bounds);
    for (const y of [124.94, 118.82, 112.89, 106.58, 100.46]) {
      assert.ok(y < bounds.upper && y > bounds.lower);
    }
    assert.ok(132.62 > bounds.upper);
    assert.ok(92.9 < bounds.lower);
  } finally { await task.destroy(); }
});

test('separator extraction respects transforms and excludes backgrounds and short cell rules', () => {
  const path = (box) => [OPS.eoFill, [], new Float32Array(box)];
  const separators = extractRowSeparators({
    fnArray: [OPS.save, OPS.transform, OPS.constructPath, OPS.restore, OPS.constructPath, OPS.constructPath],
    argsArray: [[], [1, 0, 0, 1, 0, 10], path([55, 90, 740, 90.5]), [], path([55, 10, 740, 40]), path([460, 50, 740, 50.5])]
  });
  assert.deepEqual(separators, [100.25]);
  assert.equal(rowBoundsAt(90, separators), null);
  assert.deepEqual(rowBoundsAt(90, [100, 80]), { upper: 100, lower: 80 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getShareUrl, sharePage } from '../../src/lib/share.js';

test('sharePage uses native share when available', async () => {
  let received;
  const result = await sharePage(
    { title: 'Netherlands at LA 2028', text: 'Schedule and qualification dashboard', url: 'https://games28.example/countries/NED' },
    { navigator: { share: async (payload) => { received = payload; } } }
  );

  assert.deepEqual(result, { status: 'shared', method: 'native' });
  assert.equal(received.url, 'https://games28.example/countries/NED');
});

test('sharePage falls back to copying the URL', async () => {
  let copied = '';
  const result = await sharePage(
    { url: 'https://games28.example/sessions/final' },
    { navigator: { clipboard: { writeText: async (value) => { copied = value; } } } }
  );

  assert.deepEqual(result, { status: 'shared', method: 'copy' });
  assert.equal(copied, 'https://games28.example/sessions/final');
});

test('sharePage does not treat closing the native share sheet as an error', async () => {
  const result = await sharePage(
    { url: 'https://games28.example/' },
    { navigator: { share: async () => { const error = new Error('dismissed'); error.name = 'AbortError'; throw error; } } }
  );

  assert.deepEqual(result, { status: 'cancelled', method: 'native' });
});

test('getShareUrl creates an absolute same-origin link', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://games28.example', href: 'https://games28.example/' } };

  assert.equal(getShareUrl('/countries/NED'), 'https://games28.example/countries/NED');
  globalThis.window = originalWindow;
});

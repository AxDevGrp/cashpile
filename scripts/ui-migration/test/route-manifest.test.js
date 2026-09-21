'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CRITICAL_ROUTES, validateRouteManifest } = require('../route-manifest');

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cashpile-route-manifest-'));
}

function page(root, relativePath) {
  const filePath = path.join(root, relativePath, 'page.tsx');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'export default function Page() { return null; }');
}

test('validates routes while allowing documented pre-existing missing routes', () => {
  const root = fixture();
  page(root, '(app)/cashboard');

  const result = validateRouteManifest(root, [
    { path: '/cashboard', status: 'present' },
    { path: '/trades/metrics', status: 'pre-existing-missing' },
  ]);

  assert.deepEqual(result, { missing: [], undocumented: [] });
});

test('reports missing required routes and invalid exception records', () => {
  const root = fixture();
  page(root, 'unknown');
  const result = validateRouteManifest(root, [
    { path: '/cashboard', status: 'present' },
    { path: '/trades/metrics', status: 'pre-existing-missing' },
    { path: '/unknown', status: 'pre-existing-missing' },
  ]);

  assert.deepEqual(result, {
    missing: ['/cashboard'],
    undocumented: ['/unknown'],
  });
});

test('critical manifest documents the /trades/metrics exception', () => {
  assert.deepEqual(
    CRITICAL_ROUTES.filter((route) => route.status === 'pre-existing-missing'),
    [{ path: '/trades/metrics', status: 'pre-existing-missing', note: 'Pre-existing missing route; retained as a documented deep-link exception.' }],
  );
});

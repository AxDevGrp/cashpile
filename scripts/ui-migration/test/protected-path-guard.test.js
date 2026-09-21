'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildManifest,
  compareManifests,
  selectProtectedFiles,
} = require('../protected-path-guard');

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cashpile-ui-guard-'));
}

function write(root, relativePath, contents = 'x') {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

test('selects protected files, including untracked files, and ignores generated artifacts', () => {
  const root = fixture();
  write(root, 'apps/web/src/app/api/health/route.ts', 'api');
  write(root, 'apps/web/src/modules/books/service.ts', 'module');
  write(root, 'apps/web/src/lib/plaid.ts', 'plaid');
  write(root, 'apps/web/src/lib/plaid-extra.ts', 'plaid extra');
  write(root, 'apps/web/src/lib/tax-access.ts', 'tax');
  write(root, 'apps/web/src/middleware.ts', 'middleware');
  write(root, 'packages/ai/src/tool.ts', 'ai');
  write(root, 'packages/db/migrations/001.sql', 'db');
  write(root, 'packages/db/node_modules/pkg/index.js', 'ignored');
  write(root, 'packages/db/dist/output.js', 'ignored');
  write(root, 'packages/db/cache.tsbuildinfo', 'ignored');
  write(root, 'apps/web/src/app/api/.next/cache.js', 'ignored');

  assert.deepEqual(selectProtectedFiles(root), [
    'apps/web/src/app/api/health/route.ts',
    'apps/web/src/lib/plaid-extra.ts',
    'apps/web/src/lib/plaid.ts',
    'apps/web/src/lib/tax-access.ts',
    'apps/web/src/middleware.ts',
    'apps/web/src/modules/books/service.ts',
    'packages/ai/src/tool.ts',
    'packages/db/migrations/001.sql',
  ]);
});

test('compares manifests for modified, added, and deleted protected files', () => {
  const baseline = { version: 1, files: [
    { path: 'a.ts', sha256: 'a' },
    { path: 'deleted.ts', sha256: 'd' },
  ] };
  const current = { version: 1, files: [
    { path: 'a.ts', sha256: 'changed' },
    { path: 'added.ts', sha256: 'new' },
  ] };

  assert.deepEqual(compareManifests(baseline, current), {
    added: ['added.ts'],
    deleted: ['deleted.ts'],
    modified: ['a.ts'],
  });
});

test('buildManifest is deterministic and records hashes instead of contents', () => {
  const root = fixture();
  write(root, 'packages/ai/z.ts', 'secret-like-content');
  write(root, 'packages/ai/a.ts', 'other');

  const first = buildManifest(root);
  const second = buildManifest(root);

  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((file) => file.path), ['packages/ai/a.ts', 'packages/ai/z.ts']);
  assert.equal(JSON.stringify(first).includes('secret-like-content'), false);
});

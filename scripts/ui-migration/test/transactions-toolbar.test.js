'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(process.cwd(), 'apps/web/src/app/(app)/books/transactions/_components/transactions-client.tsx'),
  'utf8',
);

const toolbar = source.match(/<PageHeader[\s\S]*?actions=\{([\s\S]*?)\} \/>/)?.[1] ?? '';

test('transaction toolbar groups cleanup and maintenance actions', () => {
  assert.match(toolbar, /Clean up transactions/);
  assert.match(toolbar, /Start smart cleanup/);
  assert.match(toolbar, /Use rules only/);
  assert.match(toolbar, /high-confidence AI matches/);
  assert.match(toolbar, /Anything uncertain stays for your review/);
  assert.match(toolbar, /runBulkCategorization\(true\)/);
  assert.match(toolbar, /runBulkCategorization\(false\)/);
  assert.match(toolbar, /More/);
  assert.match(toolbar, /Manage category rules/);
  assert.match(toolbar, /\/books\/transactions\/duplicates/);
  assert.match(toolbar, /\/books\/transactions\/import/);
  assert.doesNotMatch(toolbar, />\s*Apply Rules\s*</);
  assert.doesNotMatch(toolbar, />\s*Rules \+ AI\s*</);
  assert.doesNotMatch(source, /Backfill Plaid|runPlaidBackfill|isBackfilling|backfillYear|backfillSummary/);
});

test('main AI review link requires review suggestions', () => {
  assert.match(
    toolbar,
    /reviewSuggestionCount > 0 && \(\s*<Link\s+href=\{aiReviewHref\}[\s\S]*?Review \{reviewSuggestionCount\} suggestion/,
  );
});

test('categorization displays an accessible indeterminate progress state', () => {
  assert.match(source, /\{isCategorizing && \(/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-label="Categorization in progress"/);
  assert.match(source, /animate-pulse/);
  assert.match(source, /Cash is cleaning up transactions/);
  assert.match(source, /categorizeMode === "rules"/);
  assert.doesNotMatch(source, /aria-valuenow|aria-valuemin|aria-valuemax/);
});

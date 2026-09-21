'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IGNORED_DIRECTORY_NAMES = new Set(['.next', '.turbo', 'coverage', 'dist', 'node_modules']);
const DEFAULT_MANIFEST_PATH = 'docs/ui-migration/protected-path-manifest.json';

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isProtectedPath(relativePath) {
  return relativePath === 'apps/web/src/middleware.ts'
    || relativePath === 'apps/web/src/lib/tax-access.ts'
    || relativePath.startsWith('apps/web/src/lib/plaid')
    || relativePath.startsWith('apps/web/src/app/api/')
    || relativePath.startsWith('apps/web/src/modules/')
    || relativePath.startsWith('packages/ai/')
    || relativePath.startsWith('packages/db/');
}

function walk(root, directory = root, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(root, filePath, files);
    else if (entry.isFile() && !entry.name.endsWith('.tsbuildinfo')) files.push(toPosix(path.relative(root, filePath)));
  }
  return files;
}

function selectProtectedFiles(root) {
  return walk(root).filter(isProtectedPath).sort();
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildManifest(root) {
  return {
    version: 1,
    files: selectProtectedFiles(root).map((relativePath) => ({
      path: relativePath,
      sha256: sha256(path.join(root, relativePath)),
    })),
  };
}

function compareManifests(baseline, current) {
  const baselineFiles = new Map(baseline.files.map((file) => [file.path, file.sha256]));
  const currentFiles = new Map(current.files.map((file) => [file.path, file.sha256]));
  const added = [...currentFiles.keys()].filter((file) => !baselineFiles.has(file)).sort();
  const deleted = [...baselineFiles.keys()].filter((file) => !currentFiles.has(file)).sort();
  const modified = [...baselineFiles.keys()]
    .filter((file) => currentFiles.has(file) && currentFiles.get(file) !== baselineFiles.get(file))
    .sort();
  return { added, deleted, modified };
}

function readManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) {
    throw new Error(`Invalid protected-path manifest: ${manifestPath}`);
  }
  return manifest;
}

function formatDifferences(differences) {
  return ['modified', 'added', 'deleted']
    .flatMap((kind) => differences[kind].map((file) => `  ${kind}: ${file}`))
    .join('\n');
}

function capture(root, manifestPath) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(buildManifest(root), null, 2)}\n`);
}

function check(root, manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Protected-path manifest does not exist: ${manifestPath}. Run capture first.`);
  }
  const differences = compareManifests(readManifest(manifestPath), buildManifest(root));
  if (differences.added.length || differences.deleted.length || differences.modified.length) {
    throw new Error(`Protected backend files changed since capture:\n${formatDifferences(differences)}`);
  }
}

function main(args) {
  const [command, manifestArgument] = args;
  const root = path.resolve(__dirname, '../..');
  const manifestPath = path.resolve(root, manifestArgument || DEFAULT_MANIFEST_PATH);
  if (command === 'capture') {
    capture(root, manifestPath);
    console.log(`Captured protected-path manifest: ${path.relative(root, manifestPath)}`);
  } else if (command === 'check') {
    check(root, manifestPath);
    console.log(`Protected-path check passed: ${path.relative(root, manifestPath)}`);
  } else {
    throw new Error('Usage: node scripts/ui-migration/protected-path-guard.js <capture|check> [manifest-path]');
  }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildManifest, check, compareManifests, selectProtectedFiles };

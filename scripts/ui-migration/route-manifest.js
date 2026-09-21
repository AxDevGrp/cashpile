'use strict';

const fs = require('node:fs');
const path = require('node:path');
const CRITICAL_ROUTES = require('./critical-routes.json');

function routeForPage(appDirectory, filePath) {
  const segments = path.relative(appDirectory, path.dirname(filePath)).split(path.sep)
    .filter((segment) => !(/^\(.+\)$/).test(segment));
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

function findPageRoutes(appDirectory, directory = appDirectory, routes = new Set()) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) findPageRoutes(appDirectory, entryPath, routes);
    else if (entry.isFile() && entry.name === 'page.tsx') routes.add(routeForPage(appDirectory, entryPath));
  }
  return routes;
}

function validateRouteManifest(appDirectory, routes = CRITICAL_ROUTES) {
  const available = findPageRoutes(appDirectory);
  const missing = [];
  const undocumented = [];
  for (const route of routes) {
    if (route.status === 'present' && !available.has(route.path)) missing.push(route.path);
    if (route.status === 'pre-existing-missing' && available.has(route.path)) undocumented.push(route.path);
  }
  return { missing: missing.sort(), undocumented: undocumented.sort() };
}

function main() {
  const root = path.resolve(__dirname, '../..');
  const result = validateRouteManifest(path.join(root, 'apps/web/src/app'));
  if (result.missing.length || result.undocumented.length) {
    throw new Error(`Route manifest validation failed:\nmissing: ${result.missing.join(', ') || 'none'}\nexception now present: ${result.undocumented.join(', ') || 'none'}`);
  }
  console.log(`Route manifest validated: ${CRITICAL_ROUTES.length} routes (${CRITICAL_ROUTES.filter((route) => route.status === 'pre-existing-missing').length} documented exception).`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { CRITICAL_ROUTES, findPageRoutes, validateRouteManifest };

'use strict';

const { resolve } = require('./resolver.js');

// This implementation differs from the specification since the specification
// implementation integrates closely with the module loading algorithm.
exports.traceDepcache = traceDepcache;
function traceDepcache(url, parsedImportMap, visited = new Set()) {
  const urlString = url.href;
  if (visited.has(urlString)) {
    return visited;
  }
  visited.add(urlString);

  const dependencies = parsedImportMap.depcache[urlString] || [];
  for (const dep of dependencies) {
    console.log(dep);
    const resolved = resolve(dep, parsedImportMap, url);
    traceDepcache(resolved, parsedImportMap, visited);
  }
  return [...visited];
}

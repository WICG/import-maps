'use strict';
const { sortObjectKeysByLongestFirst } = require('./utils.js');

exports.appendMap = (baseMap, newMap) => {
  return {
    imports: joinHelper(baseMap.imports, [baseMap.imports], newMap.imports),
    scopes: sortObjectKeysByLongestFirst(Object.fromEntries([
      ...Object.entries(baseMap.scopes)
        .map(([scopePrefix, scopeMapping]) => [scopePrefix, joinHelper(scopeMapping, [], {})]),
      ...Object.entries(newMap.scopes).map(([scopePrefix, scopeMapping]) => [
        scopePrefix,
        joinHelper(
          baseMap.scopes[scopePrefix],
          [baseMap.imports, ...scopesMatchingPrefix(scopePrefix, baseMap.scopes)],
          scopeMapping
        )
      ])
    ]))
  };
};

function joinHelper(oldMapping = {}, applicableContexts, newMapping) {
  return Object.fromEntries([
    ...Object.entries(oldMapping).map(([moduleSpecifier, fallbacks]) => [moduleSpecifier, [...fallbacks]]),
    ...Object.entries(newMapping).map(([moduleSpecifier, fallbacks]) =>
      [moduleSpecifier, fallbacks.flatMap(fallback => applyCascadeWithContexts(fallback, applicableContexts))])
  ]);
}

// string -> Array<Map<string, Array<string>>> -> Array<string>
function applyCascadeWithContexts(moduleSpecifier, applicableMapContexts) {
  if (applicableMapContexts.length < 1) {
    return [moduleSpecifier];
  }
  const [head, ...tail] = applicableMapContexts;
  return moduleSpecifier in head ? head[moduleSpecifier] : applyCascadeWithContexts(moduleSpecifier, tail);
}

function scopesMatchingPrefix(prefix, scopesObject) {
  return Object.keys(scopesObject)
    .filter(scopePrefix => scopePrefix === prefix || (scopePrefix.endsWith('/') && prefix.startsWith(scopePrefix)))
    .map(s => scopesObject[s]);
}

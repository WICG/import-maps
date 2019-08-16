'use strict';
const { getFallbacks } = require('./resolver.js');
const { tryURLLikeSpecifierParse, sortObjectKeysByLongestFirst } = require('./utils.js');

exports.appendMap = (baseMap, newMap) => {
  return {
    imports: joinHelper(baseMap, baseMap.imports, newMap.imports, null),
    scopes: sortObjectKeysByLongestFirst(Object.assign(
      cloneScopes(baseMap.scopes),
      mapValues(newMap.scopes, (scopePrefix, scopeMapping) => joinHelper(
        baseMap,
        baseMap.scopes[scopePrefix] || {},
        scopeMapping,
        scopePrefix
      ))
    ))
  };
};

function joinHelper(baseMap, oldSpecifierMap, newSpecifierMap, resolutionContext) {
  const resolvedNewSpecifierMap = mapValues(
    newSpecifierMap,
    (moduleSpecifier, fallbacks) => fallbacks.flatMap(fallback =>
      getFallbacks(fallback, baseMap, resolutionContext).filter(fb => {
        if (tryURLLikeSpecifierParse(fb).type !== 'url') {
          console.warn(`Non-URL specifier ${JSON.stringify(fb)} is not allowed to be ` +
            'the target of an import mapping following composition.');
          return false;
        }
        return true;
      }))
  );
  return Object.assign(cloneSpecifierMap(oldSpecifierMap), resolvedNewSpecifierMap);
}

function cloneSpecifierMap(specifierMap) {
  return mapValues(specifierMap, (moduleSpecifier, fallbacks) => [...fallbacks]);
}

function cloneScopes(scopeObject) {
  return mapValues(scopeObject, (scopePrefix, specifierMap) => cloneSpecifierMap(specifierMap));
}

function mapValues(obj, fn) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(k, v)]));
}

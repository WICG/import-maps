'use strict';
const { getFallbacks } = require('./resolver.js');
const { parseSpecifier, sortObjectKeysByLongestFirst } = require('./utils.js');

exports.concatMaps = (baseImportMap, newImportMap) => {
  const concatenatedImportMap = {
    imports: {},
    scopes: {}
  };

  concatenatedImportMap.imports = concatSpecifierMaps(baseImportMap.imports, newImportMap.imports, baseImportMap, null);

  concatenatedImportMap.scopes = Object.assign({}, baseImportMap.scopes);
  for (const [scopePrefix, newScopeSpecifierMap] of Object.entries(newImportMap.scopes)) {
    const baseScopeSpecifierMap = baseImportMap.scopes[scopePrefix] || {};
    concatenatedImportMap.scopes[scopePrefix] =
      concatSpecifierMaps(baseScopeSpecifierMap, newScopeSpecifierMap, baseImportMap, scopePrefix);
  }
  concatenatedImportMap.scopes = sortObjectKeysByLongestFirst(concatenatedImportMap.scopes);

  return concatenatedImportMap;
};

function concatSpecifierMaps(baseSpecifierMap, newSpecifierMap, contextImportMap, scopePrefix) {
  const concatenatedSpecifierMap = Object.assign({}, baseSpecifierMap);

  for (const [specifier, addresses] of Object.entries(newSpecifierMap)) {
    const newAddresses = [];
    for (const address of addresses) {
      const fallbacks = getFallbacks(address, contextImportMap, scopePrefix);
      for (const fallback of fallbacks) {
        if (parseSpecifier(fallback).type !== 'URL') {
          console.warn(`Non-URL specifier ${JSON.stringify(fallback)} is not allowed to be ` +
            'the target of an import mapping following composition.');
          continue;
        }
        newAddresses.push(fallback);
      }
    }
    concatenatedSpecifierMap[specifier] = newAddresses;
  }
  return sortObjectKeysByLongestFirst(concatenatedSpecifierMap);
}

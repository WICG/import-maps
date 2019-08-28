'use strict';
const { URL } = require('url');
const assert = require('assert');
const {
  parseSpecifier,
  BUILT_IN_MODULE_SCHEME
} = require('./utils.js');

// TODO: clean up by allowing caller (and thus tests) to choose the list of built-ins?
const supportedBuiltInModules = new Set([
  `${BUILT_IN_MODULE_SCHEME}:blank`,
  `${BUILT_IN_MODULE_SCHEME}:blank/for-testing` // NOTE: not in the spec.
]);

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const taggedSpecifier = parseSpecifier(specifier, scriptURL);
  if (taggedSpecifier.type === 'invalid') {
    throw new TypeError(taggedSpecifier.message);
  }
  const fallbacks = exports.getFallbacks(taggedSpecifier.specifier, parsedImportMap, scriptURL.href);
  for (const address of fallbacks) {
    const taggedSpecifierValue = parseSpecifier(address, scriptURL);
    if (taggedSpecifierValue.type !== 'URL') {
      throw new TypeError(`The specifier ${JSON.stringify(specifier)} was resolved to ` +
        `non-URL ${JSON.stringify(address)}.`);
    }
    if (!taggedSpecifierValue.isBuiltin || supportedBuiltInModules.has(taggedSpecifierValue.specifier)) {
      return new URL(taggedSpecifierValue.specifier);
    }
  }
  throw new TypeError(`The specifier ${JSON.stringify(specifier)} could not be resolved.`);
};

exports.getFallbacks = (normalizedSpecifier, parsedImportMap, resolutionContext) => {
  const applicableSpecifierMaps = resolutionContext === null ?
    [parsedImportMap.imports] :
    Object.keys(parsedImportMap.scopes)
      .filter(scopePrefix =>
        scopePrefix === resolutionContext || (scopePrefix.endsWith('/') && resolutionContext.startsWith(scopePrefix)))
      .map(scopePrefix => parsedImportMap.scopes[scopePrefix])
      .concat([parsedImportMap.imports]);
  for (const specifierMap of applicableSpecifierMaps) {
    for (const [specifierKey, fallbacks] of Object.entries(specifierMap)) {
      if (specifierKey === normalizedSpecifier) {
        // Exact-match case
        return fallbacks;
      } else if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
        // Package prefix-match case
        const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
        fallbacks.forEach(fallback => {
          // Enforced by parsing
          assert(fallback.endsWith('/'));
        });
        return fallbacks.map(fallback => parseSpecifier(fallback + afterPrefix).specifier);
      }
    }
  }
  return [normalizedSpecifier];
};

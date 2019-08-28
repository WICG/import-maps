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

exports.getFallbacks = (normalizedSpecifier, importMap, contextURLString) => {
  const applicableSpecifierMaps = [];
  if (contextURLString !== null) {
    for (const [scopePrefix, scopeSpecifierMap] of Object.entries(importMap.scopes)) {
      if (scopePrefix === contextURLString || (scopePrefix.endsWith('/') && contextURLString.startsWith(scopePrefix))) {
        applicableSpecifierMaps.push(scopeSpecifierMap);
      }
    }
  }
  applicableSpecifierMaps.push(importMap.imports);

  for (const specifierMap of applicableSpecifierMaps) {
    for (const [specifierKey, addresses] of Object.entries(specifierMap)) {
      if (specifierKey === normalizedSpecifier) {
        // Exact-match case
        return addresses;
      }
      if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
        // Package prefix-match case
        const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
        const fallbacks = [];
        for (const address of addresses) {
          // Enforced by parsing
          assert(address.endsWith('/'));

          const parseResult = parseSpecifier(address + afterPrefix);
          assert(parseResult.specifier !== null);

          fallbacks.push(parseResult.specifier);
        }
        return fallbacks;
      }
    }
  }
  return [normalizedSpecifier];
};

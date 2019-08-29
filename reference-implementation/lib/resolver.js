'use strict';
const { URL } = require('url');
const assert = require('assert');
const {
  hasFetchScheme,
  parseSpecifier,
  BUILT_IN_MODULE_PROTOCOL
} = require('./utils.js');

// TODO: clean up by allowing caller (and thus tests) to choose the list of built-ins?
const supportedBuiltInModules = new Set([
  `${BUILT_IN_MODULE_PROTOCOL}blank`,
  `${BUILT_IN_MODULE_PROTOCOL}blank/for-testing` // NOTE: not in the spec.
]);

exports.resolve = (specifier, parsedImportMap, baseURL) => {
  const parsedSpecifier = parseSpecifier(specifier, baseURL);
  if (parsedSpecifier.type === 'invalid') {
    throw new TypeError(parsedSpecifier.message);
  }
  const fallbacks = exports.getFallbacks(parsedSpecifier.specifier, parsedImportMap, baseURL.href);
  for (const address of fallbacks) {
    const parsedFallback = parseSpecifier(address, baseURL);
    if (parsedFallback.type !== 'URL') {
      throw new TypeError(`The specifier ${JSON.stringify(specifier)} was resolved to ` +
        `non-URL ${JSON.stringify(address)}.`);
    }
    const url = new URL(parsedFallback.specifier);
    if (isValidModuleScriptURL(url)) {
      return url;
    }
  }
  throw new TypeError(`The specifier ${JSON.stringify(specifier)} could not be resolved.`);
};

// TODO: "settings object" would allow us to check the module map like the spec does, also solving the "allow the
// caller to choose" TODO above.
function isValidModuleScriptURL(url) {
  if (url.protocol === BUILT_IN_MODULE_PROTOCOL) {
    return supportedBuiltInModules.has(url.href);
  }

  /* istanbul ignore if */
  if (!hasFetchScheme(url)) {
    // The spec includes this check because it could happen due to the <script> call site, but none of the call sites
    // exercised in the reference implementation should hit this.
    assert.fail('The reference implementation should never reach here.');
    return false;
  }

  return true;
}

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

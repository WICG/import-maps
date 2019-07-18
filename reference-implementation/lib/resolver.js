'use strict';
const { URL } = require('url');
const assert = require('assert');
const { tryURLLikeSpecifierParse, BUILT_IN_MODULE_SCHEME, BUILT_IN_MODULE_PROTOCOL } = require('./utils.js');

// TODO: clean up by allowing caller (and thus tests) to choose the list of built-ins?
const supportedBuiltInModules = new Set([
  `${BUILT_IN_MODULE_SCHEME}:blank`,
  `${BUILT_IN_MODULE_SCHEME}:blank/for-testing` // NOTE: not in the spec.
]);

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const asURL = tryURLLikeSpecifierParse(specifier, scriptURL);
  const normalizedSpecifier = asURL ? asURL.href : specifier;
  const scriptURLString = scriptURL.href;

  for (const [scopePrefix, scopeImports] of Object.entries(parsedImportMap.scopes)) {
    if (scopePrefix === scriptURLString ||
        (scopePrefix.endsWith('/') && scriptURLString.startsWith(scopePrefix))) {
      const scopeImportsMatch = resolveImportsMatch(normalizedSpecifier, scopeImports);
      if (scopeImportsMatch !== null) {
        return scopeImportsMatch;
      }
    }
  }

  const topLevelImportsMatch = resolveImportsMatch(normalizedSpecifier, parsedImportMap.imports);
  if (topLevelImportsMatch !== null) {
    return topLevelImportsMatch;
  }

  // The specifier was able to be turned into a URL, but wasn't remapped into anything.
  if (asURL) {
    if (asURL.protocol === BUILT_IN_MODULE_PROTOCOL && !supportedBuiltInModules.has(asURL.href)) {
      throw new TypeError(`The "${asURL.href}" built-in module is not implemented.`);
    }
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier "${specifier}"`);
};

function resolveImportsMatch(normalizedSpecifier, specifierMap) {
  for (const [specifierKey, addresses] of Object.entries(specifierMap)) {
    // Exact-match case
    if (specifierKey === normalizedSpecifier) {
      if (addresses.length === 0) {
        throw new TypeError(`Specifier "${normalizedSpecifier}" was mapped to no addresses.`);
      } else if (addresses.length === 1) {
        const singleAddress = addresses[0];
        if (singleAddress.protocol === BUILT_IN_MODULE_PROTOCOL && !supportedBuiltInModules.has(singleAddress.href)) {
          throw new TypeError(`The "${singleAddress.href}" built-in module is not implemented.`);
        }
        return singleAddress;
      } else if (addresses.length === 2 &&
                 addresses[0].protocol === BUILT_IN_MODULE_PROTOCOL &&
                 addresses[1].protocol !== BUILT_IN_MODULE_PROTOCOL) {
        return supportedBuiltInModules.has(addresses[0].href) ? addresses[0] : addresses[1];
      } else {
        throw new Error('The reference implementation for multi-address fallbacks that are not ' +
                        '[built-in module, fetch-scheme URL] is not yet implemented.');
      }
    }

    // Package prefix-match case
    if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      if (addresses.length === 0) {
        throw new TypeError(`Specifier "${normalizedSpecifier}" was mapped to no addresses ` +
                            `(via prefix specifier key "${specifierKey}").`);
      } else if (addresses.length === 1) {
        const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

        // Enforced by parsing
        assert(addresses[0].href.endsWith('/'));

        // Cannot use URL resolution directly. E.g. "switch" relative to "std:elements/" is a
        // parsing failure.
        return new URL(addresses[0] + afterPrefix);
      } else if (addresses.length === 2 &&
                 addresses[0].protocol === BUILT_IN_MODULE_PROTOCOL &&
                 addresses[1].protocol !== BUILT_IN_MODULE_PROTOCOL) {
        const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

        // Enforced by parsing
        assert(addresses[0].href.endsWith('/'));
        assert(addresses[1].href.endsWith('/'));

        // Cannot use URL resolution directly. E.g. "switch" relative to "std:elements/" is a
        // parsing failure.
        const url0 = new URL(addresses[0] + afterPrefix);
        const url1 = new URL(addresses[1] + afterPrefix);
        return supportedBuiltInModules.has(url0.href) ? url0 : url1;
      } else {
        throw new Error('The reference implementation for multi-address fallbacks that are not ' +
                        '[built-in module, fetch-scheme URL] is not yet implemented.');
      }
    }
  }
  return null;
}

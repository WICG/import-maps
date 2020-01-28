'use strict';
const assert = require('assert');
const { tryURLLikeSpecifierParse, tryURLParse } = require('./utils.js');

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
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier "${specifier}"`);
};

function resolveImportsMatch(normalizedSpecifier, specifierMap) {
  for (const [specifierKey, address] of Object.entries(specifierMap)) {
    // Exact-match case
    if (specifierKey === normalizedSpecifier) {
      if (address === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      } else {
        return address;
      }
    }

    // Package prefix-match case
    else if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      if (address === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }

      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

      // Enforced by parsing
      assert(address.href.endsWith('/'));

      const url = tryURLParse(afterPrefix, address);

      // This code looks stupid but it follows the spec more exactly and also gives code coverage a chance to shine.
      if (url === null) {
        throw new TypeError(`Failed to resolve prefix-match relative URL for "${specifierKey}"`);
      }
      return url;
    }
  }
  return null;
}

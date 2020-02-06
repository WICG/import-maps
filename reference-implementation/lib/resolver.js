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
  for (const [specifierKey, resolutionResult] of Object.entries(specifierMap)) {
    // Exact-match case
    if (specifierKey === normalizedSpecifier) {
      if (resolutionResult === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }

      assert(resolutionResult instanceof URL);

      return resolutionResult;
    }

    // Package prefix-match case
    if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      if (resolutionResult === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }

      assert(resolutionResult instanceof URL);

      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

      // Enforced by parsing
      assert(resolutionResult.href.endsWith('/'));

      const url = tryURLParse(afterPrefix, resolutionResult);

      if (url === null) {
        throw new TypeError(`Failed to resolve prefix-match relative URL for "${specifierKey}"`);
      }

      assert(url instanceof URL);

      return url;
    }
  }
  return null;
}

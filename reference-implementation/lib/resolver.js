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
    if (specifierKey === normalizedSpecifier) {
      // Exact-match case
      if (resolutionResult === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }
      return resolutionResult;
    } else if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      // Package prefix-match case
      if (resolutionResult === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }

      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

      // Enforced by parsing
      assert(resolutionResult.href.endsWith('/'));

      const url = tryURLParse(afterPrefix, resolutionResult);

      if (url === null) {
        throw new TypeError(`Failed to resolve prefix-match relative URL for "${specifierKey}" due to a URL parse failure`);
      }
      return url;
    }
  }
  return null;
}

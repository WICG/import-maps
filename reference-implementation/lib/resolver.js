'use strict';
const assert = require('assert');
const { tryURLLikeSpecifierParse, tryURLParse, isSpecial } = require('./utils.js');

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const asURL = tryURLLikeSpecifierParse(specifier, scriptURL);
  const normalizedSpecifier = asURL ? asURL.href : specifier;
  const scriptURLString = scriptURL.href;

  for (const [scopePrefix, scopeImports] of Object.entries(parsedImportMap.scopes)) {
    if (scopePrefix === scriptURLString ||
        (scopePrefix.endsWith('/') && scriptURLString.startsWith(scopePrefix))) {
      const scopeImportsMatch = resolveImportsMatch(normalizedSpecifier, asURL, scopeImports);
      if (scopeImportsMatch !== null) {
        return scopeImportsMatch;
      }
    }
  }

  const topLevelImportsMatch = resolveImportsMatch(normalizedSpecifier, asURL, parsedImportMap.imports);
  if (topLevelImportsMatch !== null) {
    return topLevelImportsMatch;
  }

  // The specifier was able to be turned into a URL, but wasn't remapped into anything.
  if (asURL) {
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier "${specifier}"`);
};

function resolveImportsMatch(normalizedSpecifier, asURL, specifierMap) {
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
    if (specifierKey.endsWith('/') &&
        normalizedSpecifier.startsWith(specifierKey) &&
        (!asURL || isSpecial(asURL))) {
      if (resolutionResult === null) {
        throw new TypeError(`Blocked by a null entry for "${specifierKey}"`);
      }

      assert(resolutionResult instanceof URL);

      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);

      // Enforced by parsing
      assert(resolutionResult.href.endsWith('/'));

      const url = tryURLParse(afterPrefix, resolutionResult);

      if (url === null) {
        throw new TypeError(`Failed to resolve the specifier "${normalizedSpecifier}" as its after-prefix portion ` +
                            `"${afterPrefix}" could not be URL-parsed relative to the URL prefix ` +
                            `"${resolutionResult.href}" mapped to by the prefix "${specifierKey}"`);
      }

      if (!url.href.startsWith(resolutionResult.href)) {
        throw new TypeError(`The specifier "${normalizedSpecifier}" backtracks above its prefix "${specifierKey}"`);
      }

      assert(url instanceof URL);

      return url;
    }
  }
  return null;
}

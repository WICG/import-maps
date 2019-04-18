'use strict';
const { URL } = require('url');
const { tryURLLikeSpecifierParse } = require('./utils.js');

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const asURL = tryURLLikeSpecifierParse(specifier, scriptURL);
  const normalizedSpecifier = asURL ? asURL.href : specifier;

  for (const [normalizedScopeKey, scopeImports] of Object.entries(parsedImportMap.scopes)) {
    if (scriptURL.href === normalizedScopeKey ||
        (normalizedScopeKey.endsWith('/') && scriptURL.href.startsWith(normalizedScopeKey))) {
      const scopeImportsMatch = resolveImportsMatch(normalizedSpecifier, scopeImports);
      if (scopeImportsMatch) {
        return scopeImportsMatch;
      }
    }
  }

  const importsMatch = resolveImportsMatch(normalizedSpecifier, parsedImportMap.imports);
  if (importsMatch) {
    return importsMatch;
  }

  // The specifier was able to be turned into a URL, but wasn't remapped into anything.
  if (asURL) {
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier "${specifier}"`);
};

function resolveImportsMatch(normalizedSpecifier, importMap) {
  for (const [specifierKey, addressArray] of Object.entries(importMap)) {
    // Exact-match case
    if (specifierKey === normalizedSpecifier) {
      if (addressArray.length === 0) {
        throw new TypeError(`Specifier "${normalizedSpecifier}" was mapped to no addresses.`);
      } else if (addressArray.length === 1) {
        return addressArray[0];
      } else {
        throw new Error('Not yet implemented.');
      }
    }

    // Package prefix-match case
    if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      if (addressArray.length === 0) {
        throw new TypeError(`Specifier "${normalizedSpecifier}" was mapped to no addresses ` +
                            `(via prefix specifier key "${specifierKey}").`);
      } else if (addressArray.length === 1) {
        const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
        return new URL(afterPrefix, addressArray[0]);
      } else {
        throw new Error('Not yet implemented.');
      }
    }
  }
  return undefined;
}

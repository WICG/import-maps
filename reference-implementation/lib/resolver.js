'use strict';
const { URL } = require('url');
const { tryURLLikeSpecifierParse } = require('./utils.js');

exports.resolve = (specifier, parsedImportMap, scriptURL) => {
  const asURL = tryURLLikeSpecifierParse(specifier, scriptURL);
  const normalizedSpecifier = asURL ? asURL.href : specifier;

  for (const [normalizedScopePrefix, scopeImports] of Object.entries(parsedImportMap.scopes)) {
    // an alternative to the double '/' check could be to normalize scopes to
    // never contain a trailing '/' in the parsing phase
    if (scriptURL.href.startsWith(normalizedScopePrefix) &&
        (scriptURL.href.length === normalizedScopePrefix.length ||
         scriptURL.href[normalizedScopePrefix.length] === '/' ||
         scriptURL.href[normalizedScopePrefix.length - 1] === '/')) {
      const scopeImportsMatch = resolveImportsMatch(normalizedSpecifier, asURL, scopeImports);
      if (scopeImportsMatch) {
        return scopeImportsMatch;
      }
      // scope match does not cascade
      break;
    }
  }

  const importsMatch = resolveImportsMatch(normalizedSpecifier, asURL, parsedImportMap.imports);
  if (importsMatch) {
    return importsMatch;
  }

  // The specifier was able to be turned into a URL, but wasn't remapped into anything.
  if (asURL) {
    return asURL;
  }

  throw new TypeError(`Unmapped bare specifier ${specifier}`);
};

function resolveImportsMatch(normalizedSpecifier, asURL, importMap) {
  for (const [specifierKey, addressArray] of Object.entries(importMap)) {
    if (addressArray.length > 1) {
      throw new Error('Not yet implemented');
    }
    if (addressArray.length === 0 && specifierKey === normalizedSpecifier) {
      throw new TypeError(`Specifier key ${normalizedSpecifier} was mapped to no addresses.`);
    }

    const address = addressArray[0]; // Per the above addressArray.length === 1
    if (specifierKey === normalizedSpecifier) {
      return address;
    }

    if (asURL === null && specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
      return new URL(afterPrefix, address);
    }
  }
  return undefined;
}

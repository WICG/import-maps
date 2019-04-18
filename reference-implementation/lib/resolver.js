'use strict';
const { URL } = require('url');
const { tryURLLikeSpecifierParse, BUILT_IN_MODULE_SCHEME, BUILT_IN_MODULE_PROTOCOL } = require('./utils.js');

const supportedBuiltInModules = new Set([`${BUILT_IN_MODULE_SCHEME}:blank`]);

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
    if (asURL.protocol === BUILT_IN_MODULE_PROTOCOL) {
      if (!supportedBuiltInModules.has(asURL.href)) {
        throw new TypeError(`The "${asURL.href}" built-in module is not implemented.`);
      }
    }
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
        if (addressArray[0].protocol === BUILT_IN_MODULE_PROTOCOL) {
          if (supportedBuiltInModules.has(addressArray[0].href)) {
            return addressArray[0];
          }
          throw new TypeError(`The "${addressArray[0].href}" built-in module is not implemented.`);
        }
        return addressArray[0];
      } else if (addressArray.length === 2 &&
                 addressArray[0].protocol === BUILT_IN_MODULE_PROTOCOL &&
                 addressArray[1].protocol !== BUILT_IN_MODULE_PROTOCOL) {
        return supportedBuiltInModules.has(addressArray[0].href) ? addressArray[0] : addressArray[1];
      } else {
        throw new Error('The reference implementation for multi-address fallbacks that are not ' +
                        '[built-in module, fetch-scheme URL] is not yet implemented.');
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
        throw new Error('The reference implementation for multi-address fallbacks that are not ' +
                        '[built-in module, fetch-scheme URL] is not yet implemented.');
      }
    }
  }
  return undefined;
}

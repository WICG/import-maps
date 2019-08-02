'use strict';
const { URL } = require('url');
const assert = require('assert');
const {
  tryURLParse,
  tryURLLikeSpecifierParse,
  BUILT_IN_MODULE_SCHEME,
  BUILT_IN_MODULE_PROTOCOL
} = require('./utils.js');

// TODO: clean up by allowing caller (and thus tests) to choose the list of built-ins?
const supportedBuiltInModules = new Set([
  `${BUILT_IN_MODULE_SCHEME}:blank`,
  `${BUILT_IN_MODULE_SCHEME}:blank/for-testing` // NOTE: not in the spec.
]);

exports.resolve = (specifier, parsedImportMap, scriptURLparameter) => {
  const scriptURL = new URL(scriptURLparameter);

  const taggedSpecifier = tryURLLikeSpecifierParse(specifier, scriptURL);
  if (taggedSpecifier.type === 'invalid') {
    throw new TypeError('Attempting to resolve invalid specifier.');
  }

  const scopeEntries = Object.entries(parsedImportMap.scopes)
    .concat([[scriptURL.href, parsedImportMap.imports]]);
  for (const [scopePrefix, scopeImports] of scopeEntries) {
    if (scopePrefix === scriptURL.href ||
        (scopePrefix.endsWith('/') && scriptURL.href.startsWith(scopePrefix))) {
      const scopeImportsMatch = resolveImportsMatch(taggedSpecifier.specifier, scopeImports, scriptURL);
      if (scopeImportsMatch !== null) {
        return scopeImportsMatch;
      }
    }
  }

  if (taggedSpecifier.type !== 'url') {
    throw new TypeError(`Unmapped bare specifier "${specifier}"`);
  }

  if (taggedSpecifier.isBuiltin && !supportedBuiltInModules.has(taggedSpecifier.specifier)) {
    throw new TypeError(`The "${taggedSpecifier.specifier}" built-in module is not implemented.`);
  }

  return new URL(taggedSpecifier.specifier);
};

function resolveImportsMatch(normalizedSpecifier, specifierMap, scriptURL) {
  for (const [specifierKey, addresses] of Object.entries(specifierMap)) {
    if (specifierKey === normalizedSpecifier) {
      // Exact-match case
      for (const address of addresses) {
        const taggedSpecifierValue = tryURLLikeSpecifierParse(address, scriptURL);
        if (taggedSpecifierValue.type !== 'url') {
          throw new TypeError(`The specifier ${JSON.stringify(normalizedSpecifier)} was resolved to ` +
            `non-URL ${JSON.stringify(address)}.`);
        }
        if (!taggedSpecifierValue.isBuiltin || supportedBuiltInModules.has(taggedSpecifierValue.specifier)) {
          return new URL(taggedSpecifierValue.specifier);
        }
      }
      throw new TypeError(`The specifier ${JSON.stringify(normalizedSpecifier)} could not be resolved.`);
    } else if (specifierKey.endsWith('/') && normalizedSpecifier.startsWith(specifierKey)) {
      // Package prefix-match case
      const afterPrefix = normalizedSpecifier.substring(specifierKey.length);
      for (const address of addresses) {
        // Enforced by parsing
        assert(address.endsWith('/'));

        const resolved = tryURLParse(`${address}${afterPrefix}`);
        if (resolved === null) {
          throw new TypeError(`The specifier ${JSON.stringify(normalizedSpecifier)} was resolved to ` +
            `non-URL ${JSON.stringify(address)}.`);
        }
        if (resolved.protocol !== BUILT_IN_MODULE_PROTOCOL || supportedBuiltInModules.has(resolved.href)) {
          return resolved;
        }
      }
      throw new TypeError(`The specifier ${JSON.stringify(normalizedSpecifier)} could not be resolved.`);
    }
  }

  return null;
}

'use strict';
const { URL } = require('url');
const { tryURLParse, hasFetchScheme, tryURLLikeSpecifierParse } = require('./utils.js');

// Tentative, so better to centralize so we can change in one place as necessary (including tests).
exports.BUILT_IN_MODULE_PREFIX = '@std/';

exports.parseFromString = (input, baseURL) => {
  const parsed = JSON.parse(input);

  if (!isJSONObject(parsed)) {
    throw new TypeError('Import map JSON must be an object.');
  }

  if ('imports' in parsed && !isJSONObject(parsed.imports)) {
    throw new TypeError('Import map\'s imports value must be an object.');
  }

  if ('scopes' in parsed && !isJSONObject(parsed.scopes)) {
    throw new TypeError('Import map\'s scopes value must be an object.');
  }

  let normalizedImports = {};
  if ('imports' in parsed) {
    normalizedImports = normalizeSpecifierMap(parsed.imports, baseURL);
  }

  const normalizedScopes = {};
  if ('scopes' in parsed) {
    for (const [scopePrefix, specifierMap] of Object.entries(parsed.scopes)) {
      if (!isJSONObject(specifierMap)) {
        throw new TypeError(`The value for the "${scopePrefix}" scope prefix must be an object.`);
      }

      const scopePrefixURL = tryURLParse(scopePrefix, baseURL);
      if (scopePrefixURL === null) {
        continue;
      }

      if (!hasFetchScheme(scopePrefixURL)) {
        continue;
      }

      const normalizedScopePrefix = scopePrefixURL.href;
      normalizedScopes[normalizedScopePrefix] = normalizeSpecifierMap(specifierMap, baseURL);
    }
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: normalizedImports,
    scopes: normalizedScopes
  };
};

function normalizeSpecifierMap(obj, baseURL) {
  // Normalize all entries into arrays
  const result = {};
  for (const [specifierKey, value] of Object.entries(obj)) {
    const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL);
    if (normalizedSpecifierKey === null) {
      continue;
    }

    if (typeof value === 'string') {
      result[normalizedSpecifierKey] = [value];
    } else if (value === null) {
      result[normalizedSpecifierKey] = [];
    } else if (Array.isArray(value)) {
      result[normalizedSpecifierKey] = obj[specifierKey];
    }
  }

  // Normalize/validate each potential address in the array
  for (const [key, addressArray] of Object.entries(result)) {
    result[key] = addressArray
      .map(address => normalizeAddress(address, baseURL))
      .filter(address => address !== null);
  }

  return result;
}

function normalizeSpecifierKey(specifierKey, baseURL) {
  // Ignore attempts to use the empty string as a specifier key
  if (specifierKey === '') {
    return null;
  }

  const url = tryURLLikeSpecifierParse(specifierKey, baseURL);
  if (url !== null) {
    return url.href;
  }

  return specifierKey;
}

// Returns null if `address` is not a valid address, and a `URL` instance if it is.
function normalizeAddress(address, baseURL) {
  if (typeof address !== 'string') {
    return null;
  }

  if (address.startsWith(exports.BUILT_IN_MODULE_PREFIX)) {
    return new URL('import:' + address);
  }

  return tryURLLikeSpecifierParse(address, baseURL);
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

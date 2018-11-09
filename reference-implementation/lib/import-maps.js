'use strict';
const { URL } = require('url');

// https://fetch.spec.whatwg.org/#fetch-scheme
const FETCH_SCHEMES = new Set(['http', 'https', 'ftp', 'about', 'blob', 'data', 'file', 'filesystem']);

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

  if ('imports' in parsed) {
    normalizeSpecifierMap(parsed.imports, baseURL);
  }

  const normalizedScopes = {};
  if ('scopes' in parsed) {
    for (const [scopePrefix, specifierMap] of Object.entries(parsed.scopes)) {
      if (!isJSONObject(specifierMap)) {
        throw new TypeError(`The value for the "${scopePrefix}" scope prefix must be an object.`);
      }

      normalizeSpecifierMap(specifierMap, baseURL);

      const scopePrefixURL = tryURLParse(scopePrefix, baseURL);
      if (scopePrefixURL === null) {
        continue;
      }

      if (!hasFetchScheme(scopePrefixURL)) {
        continue;
      }

      const normalizedScopePrefix = scopePrefixURL.href;
      normalizedScopes[normalizedScopePrefix] = specifierMap;
    }
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: parsed.imports || {},
    scopes: normalizedScopes
  };
};

function normalizeSpecifierMap(obj, baseURL) {
  // Ignore attempts to use the empty string as a specifier key
  delete obj[''];

  // Normalize all entries into arrays
  for (const [specifierKey, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      obj[specifierKey] = [value];
    } else if (!Array.isArray(value)) {
      delete obj[specifierKey];
    }
  }

  // Normalize/validate each potential address in the array
  for (const [key, addressArray] of Object.entries(obj)) {
    obj[key] = addressArray
      .map(address => normalizeAddress(address, baseURL))
      .filter(address => address !== null);
  }
}

// Returns null if `address` is not a valid address, and a `URL` instance if it is.
function normalizeAddress(address, baseURL) {
  if (typeof address !== 'string') {
    return null;
  }

  if (address.startsWith(exports.BUILT_IN_MODULE_PREFIX)) {
    return new URL('import:' + address);
  }

  if (address.startsWith('./') || address.startsWith('../') || address.startsWith('/')) {
    return new URL(address, baseURL);
  }

  const url = tryURLParse(address);
  if (url === null) {
    return null;
  }

  if (hasFetchScheme(url)) {
    return url;
  }

  return null;
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasFetchScheme(url) {
  return FETCH_SCHEMES.has(url.protocol.slice(0, -1));
}

function tryURLParse(string, baseURL) {
  try {
    return new URL(string, baseURL);
  } catch (e) { // TODO remove useless binding when ESLint and Jest support that
    return null;
  }
}

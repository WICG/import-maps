'use strict';
const { tryURLParse, hasFetchScheme, tryURLLikeSpecifierParse } = require('./utils.js');

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

  const sortedAndNormalizedImports = {};
  const sortedImportsKeys = Object.keys(normalizedImports).sort(longerLengthThenCodeUnitOrder);
  for (const key of sortedImportsKeys) {
    sortedAndNormalizedImports[key] = normalizedImports[key];
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
        console.warn(`Invalid scope "${scopePrefixURL}". Scope URLs must have a fetch scheme.`);
        continue;
      }

      const normalizedScopePrefix = scopePrefixURL.href;
      normalizedScopes[normalizedScopePrefix] = normalizeSpecifierMap(specifierMap, baseURL);
    }
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: sortedAndNormalizedImports,
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
      .filter(address => {
        if (address === null) {
          return false;
        }
        if (key[key.length - 1] === '/' && address.href[address.href.length - 1] !== '/') {
          console.warn(`Invalid target address "${address}" for package specifier "${key}". ` +
              `Package address targets must end with "/".`);
          return false;
        }
        return true;
      });
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

  return tryURLLikeSpecifierParse(address, baseURL);
}

function isJSONObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function longerLengthThenCodeUnitOrder(a, b) {
  return compare(b.length, a.length) || compare(a, b);
}

function compare(a, b) {
  if (a > b) {
    return 1;
  }
  if (b > a) {
    return -1;
  }
  return 0;
}

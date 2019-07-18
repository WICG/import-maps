'use strict';
const assert = require('assert');
const { tryURLParse, hasFetchScheme, tryURLLikeSpecifierParse } = require('./utils.js');

exports.parseFromString = (input, baseURL) => {
  const parsed = JSON.parse(input);

  if (!isJSONObject(parsed)) {
    throw new TypeError('Import map JSON must be an object.');
  }

  let sortedAndNormalizedImports = {};
  if ('imports' in parsed) {
    if (!isJSONObject(parsed.imports)) {
      throw new TypeError('Import map\'s imports value must be an object.');
    }
    sortedAndNormalizedImports = sortAndNormalizeSpecifierMap(parsed.imports, baseURL);
  }

  let sortedAndNormalizedScopes = {};
  if ('scopes' in parsed) {
    if (!isJSONObject(parsed.scopes)) {
      throw new TypeError('Import map\'s scopes value must be an object.');
    }
    sortedAndNormalizedScopes = sortAndNormalizeScopes(parsed.scopes, baseURL);
  }

  const badTopLevelKeys = new Set(Object.keys(parsed));
  badTopLevelKeys.delete('imports');
  badTopLevelKeys.delete('scopes');
  for (const badKey of badTopLevelKeys) {
    console.warn(`Invalid top-level key "${badKey}". Only "imports" and "scopes" can be present.`);
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: sortedAndNormalizedImports,
    scopes: sortedAndNormalizedScopes
  };
};

function sortAndNormalizeSpecifierMap(obj, baseURL) {
  assert(isJSONObject(obj));

  // Normalize all entries into arrays
  const normalized = {};
  for (const [specifierKey, value] of Object.entries(obj)) {
    const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL);
    if (normalizedSpecifierKey === null) {
      continue;
    }

    if (typeof value === 'string') {
      normalized[normalizedSpecifierKey] = [value];
    } else if (value === null) {
      normalized[normalizedSpecifierKey] = [];
    } else if (Array.isArray(value)) {
      normalized[normalizedSpecifierKey] = obj[specifierKey];
    } else {
      console.warn(`Invalid address ${JSON.stringify(value)} for the specifier key "${specifierKey}". ` +
          `Addresses must be strings, arrays, or null.`);
    }
  }

  // Normalize/validate each potential address in the array
  for (const [specifierKey, potentialAddresses] of Object.entries(normalized)) {
    assert(Array.isArray(potentialAddresses));

    const validNormalizedAddresses = [];
    for (const potentialAddress of potentialAddresses) {
      if (typeof potentialAddress !== 'string') {
        console.warn(`Invalid address ${JSON.stringify(potentialAddress)} inside the address array for the ` +
            `specifier key "${specifierKey}". Address arrays must only contain strings.`);
        continue;
      }

      const addressURL = tryURLLikeSpecifierParse(potentialAddress, baseURL);
      if (addressURL === null) {
        console.warn(`Invalid address "${potentialAddress}" for the specifier key "${specifierKey}".`);
        continue;
      }

      if (specifierKey.endsWith('/') && !addressURL.href.endsWith('/')) {
        console.warn(`Invalid address "${addressURL.href}" for package specifier key "${specifierKey}". ` +
            `Package addresses must end with "/".`);
        continue;
      }

      validNormalizedAddresses.push(addressURL);
    }
    normalized[specifierKey] = validNormalizedAddresses;
  }

  const sortedAndNormalized = {};
  const sortedKeys = Object.keys(normalized).sort(longerLengthThenCodeUnitOrder);
  for (const key of sortedKeys) {
    sortedAndNormalized[key] = normalized[key];
  }

  return sortedAndNormalized;
}

function sortAndNormalizeScopes(obj, baseURL) {
  const normalized = {};
  for (const [scopePrefix, potentialSpecifierMap] of Object.entries(obj)) {
    if (!isJSONObject(potentialSpecifierMap)) {
      throw new TypeError(`The value for the "${scopePrefix}" scope prefix must be an object.`);
    }

    const scopePrefixURL = tryURLParse(scopePrefix, baseURL);
    if (scopePrefixURL === null) {
      console.warn(`Invalid scope "${scopePrefix}" (parsed against base URL "${baseURL}").`);
      continue;
    }

    if (!hasFetchScheme(scopePrefixURL)) {
      console.warn(`Invalid scope "${scopePrefixURL}". Scope URLs must have a fetch scheme.`);
      continue;
    }

    const normalizedScopePrefix = scopePrefixURL.href;
    normalized[normalizedScopePrefix] = sortAndNormalizeSpecifierMap(potentialSpecifierMap, baseURL);
  }

  const sortedAndNormalized = {};
  const sortedKeys = Object.keys(normalized).sort(longerLengthThenCodeUnitOrder);
  for (const key of sortedKeys) {
    sortedAndNormalized[key] = normalized[key];
  }

  return sortedAndNormalized;
}

function normalizeSpecifierKey(specifierKey, baseURL) {
  // Ignore attempts to use the empty string as a specifier key
  if (specifierKey === '') {
    console.warn(`Invalid empty string specifier key.`);
    return null;
  }

  const url = tryURLLikeSpecifierParse(specifierKey, baseURL);
  if (url !== null) {
    return url.href;
  }

  return specifierKey;
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

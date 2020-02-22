'use strict';
const assert = require('assert');
const { tryURLParse, tryURLLikeSpecifierParse } = require('./utils.js');

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

  let normalizedDepcache = {};
  if ('depcache' in parsed) {
    if (!isJSONObject(parsed.depcache)) {
      throw new TypeError('Import map\'s depcache value must be an object.');
    }
    normalizedDepcache = normalizeDepcache(parsed.depcache, baseURL);
  }

  const badTopLevelKeys = new Set(Object.keys(parsed));
  badTopLevelKeys.delete('imports');
  badTopLevelKeys.delete('scopes');
  badTopLevelKeys.delete('depcache');
  for (const badKey of badTopLevelKeys) {
    console.warn(`Invalid top-level key "${badKey}". Only "imports" and "scopes" can be present.`);
  }

  // Always have these two keys, and exactly these two keys, in the result.
  return {
    imports: sortedAndNormalizedImports,
    scopes: sortedAndNormalizedScopes,
    depcache: normalizedDepcache
  };
};

function sortAndNormalizeSpecifierMap(obj, baseURL) {
  assert(isJSONObject(obj));

  const normalized = {};
  for (const [specifierKey, value] of Object.entries(obj)) {
    const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL);
    if (normalizedSpecifierKey === null) {
      continue;
    }

    if (typeof value !== 'string') {
      console.warn(`Invalid address ${JSON.stringify(value)} for the specifier key "${specifierKey}". ` +
          `Addresses must be strings.`);
      normalized[normalizedSpecifierKey] = null;
      continue;
    }

    const addressURL = tryURLLikeSpecifierParse(value, baseURL);
    if (addressURL === null) {
      console.warn(`Invalid address "${value}" for the specifier key "${specifierKey}".`);
      normalized[normalizedSpecifierKey] = null;
      continue;
    }

    if (specifierKey.endsWith('/') && !addressURL.href.endsWith('/')) {
      console.warn(`Invalid address "${addressURL.href}" for package specifier key "${specifierKey}". ` +
          `Package addresses must end with "/".`);
      normalized[normalizedSpecifierKey] = null;
      continue;
    }

    normalized[normalizedSpecifierKey] = addressURL;
  }

  const sortedAndNormalized = {};
  const sortedKeys = Object.keys(normalized).sort((a, b) => codeUnitCompare(b, a));
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

    const normalizedScopePrefix = scopePrefixURL.href;
    normalized[normalizedScopePrefix] = sortAndNormalizeSpecifierMap(potentialSpecifierMap, baseURL);
  }

  const sortedAndNormalized = {};
  const sortedKeys = Object.keys(normalized).sort((a, b) => codeUnitCompare(b, a));
  for (const key of sortedKeys) {
    sortedAndNormalized[key] = normalized[key];
  }

  return sortedAndNormalized;
}

function normalizeDepcache(obj, baseURL) {
  const normalized = {};
  for (const [module, dependencies] of Object.entries(obj)) {
    if (!isJSONArray(dependencies)) {
      throw new TypeError(`The value for the "${module}" depcache dependencies must be an array.`);
    }

    const moduleURL = tryURLParse(module, baseURL);
    if (moduleURL === null) {
      console.warn(`Invalid depcache entry URL "${module}" (parsed against base URL "${baseURL}").`);
      continue;
    }

    let validDependencies = true;
    for (const dependency of dependencies) {
      if (typeof dependency !== 'string') {
        console.warn(`Invalid depcache item type "${typeof dependency}" for "${module}, only strings are permitted.`);
        validDependencies = false;
        break;
      }
    }
    if (dependencies.length && validDependencies) {
      const normalizedModule = moduleURL.href;
      normalized[normalizedModule] = dependencies;
    }
  }

  return normalized;
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

function isJSONArray(value) {
  return Array.isArray(value);
}

function codeUnitCompare(a, b) {
  if (a > b) {
    return 1;
  }

  /* istanbul ignore else */
  if (b > a) {
    return -1;
  }

  /* istanbul ignore next */
  throw new Error('This should never be reached because this is only used on JSON object keys');
}

'use strict';

exports.appendMap = (baseMap, newMap) => {
  return {
    imports: joinHelper(baseMap.imports, [baseMap.imports], newMap.imports),
    scopes: Object.fromEntries([
      ...Object.entries(baseMap.scopes).map(([scopePrefix, scopeMapping]) =>
        [scopePrefix, joinHelper(scopeMapping, [], {})] // clones scopeMapping
      ),
      ...Object.entries(newMap.scopes).map(([scopePrefix, scopeMapping]) =>
        [scopePrefix, joinHelper(baseMap.scopes[scopePrefix], [baseMap.imports, ...scopesMatchingPrefix(scopePrefix, baseMap.scopes)], scopeMapping)]
      ),
    ]),
  };
};

function joinHelper(oldMapping = {}, applicableContexts, newMapping) {
  return Object.fromEntries([
    ...Object.entries(oldMapping).map(([moduleSpecifier, fallbacks]) => [moduleSpecifier, [...fallbacks]]),
    ...Object.entries(newMapping).map(([moduleSpecifier, fallbacks]) =>
      [moduleSpecifier, fallbacks.flatMap(fallback => applyCascadeWithContexts(fallback, applicableContexts))]
    ),
  ]);
}

// string -> Array<Map<string, Array<string>>> -> Array<string>
function applyCascadeWithContexts(moduleSpecifier, applicableMapContexts) {
  if (applicableMapContexts.length < 1) {
    return [moduleSpecifier];
  }
  let [head, ...tail] = applicableMapContexts;
  return moduleSpecifier in head ? head[moduleSpecifier] : applyCascadeWithContexts(moduleSpecifier, tail);
}

function scopesMatchingPrefix(prefix, scopesObject) {
  return Object.keys(scopesObject).filter(scopePrefix =>
    scopePrefix === prefix || (scopePrefix.endsWith('/') && prefix.startsWith(scopePrefix))
  ).sort(shorterLengthThenCodeUnitOrder).map(s => scopesObject[s]);
}

function shorterLengthThenCodeUnitOrder(a, b) {
  return compare(a.length, b.length) || compare(a, b);
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

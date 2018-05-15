/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A Scope and also the top-level interface for package name mappings.
 */
export interface Scope {
  path_prefix?: string;
  packages?: {[name: string]: Package};
  scopes?: {[path: string]: Scope};
}

export interface Package {
  main: string;
  path?: string;
}

/**
 * A path/Scope pair for use in the internal algorithm.
 */
interface ScopeEntry {
  path: string;
  scope: Scope;
}

/**
 * The result of the FindPackageEntry operation.
 */
interface FindPackageResult {
  scopeContext: ScopeEntry[];
  packageName?: string;
  package?: Package;
}

/**
 * An object that can resolve specifiers using its package name map
 * configuration object.
 *
 * The schema of the configuration object is defined in the proposal.
 *
 * Currently this class can only have one mapping, but a future change could
 * support multiple mappings, added over time, as discussed in
 * https://github.com/domenic/package-name-maps/issues/14
 *
 * This class doesn't yet implement any validation of the mapping. We need to
 * decide whether validation errors should be early or late errors. Either way,
 * it's still a TODO to implement a validate() method.
 */
export class PackageNameMap {
  private _map: Scope;

  constructor(map: Scope) {
    this._map = map;
  }

  resolve(specifier: string, referrerURL: string): string {
    // 1. If specifier parses as absolute URL, return the specifier.
    try {
      new URL(specifier);
      return specifier;
    } catch (e) {
      // proceed
    }

    // 2. If specifier starts with `./`, `../`,  or `/`, return the specifier.
    if (/^\.{0,2}\//.test(specifier)) {
      return specifier;
    }

    // 3. Find the applicable scope based on referrerURL.
    const initialScopeContext = getScopeContext(this._map, referrerURL);

    // 4. Find the package entry.
    const {scopeContext, packageName, package: pkg} = findPackage(
      initialScopeContext,
      specifier
    );

    // 5. If no package entry is found, throw an error.
    if (pkg === undefined) {
      throw new Error(`Unable to resolve specifier ${specifier}`);
    }

    // 6. If the specifier is to a submodel, but the package doesn't have a
    //    path, throw an error.
    if (specifier !== packageName && pkg.path === undefined) {
      throw new Error(
        `Cannot resolve specifier, no path found for package ${packageName}`
      );
    }

    // 7. Build the path of the scope containing the found package
    const packagePathPrefix = joinPaths(...scopeContext.map((s) => s.path));

    // 8. Return the path to the module
    const packageScope = scopeContext[scopeContext.length - 1].scope;

    // If the specifier is fully "bare" (it's only a package name), then use
    // the Package's main file, otherwise remove the package name from the
    // specifier to get the package-internal path to the module.
    const modulePath =
      specifier === packageName
        ? pkg.main
        : specifier.substring(packageName!.length);

    return joinPaths(
      packagePathPrefix,
      packageScope.path_prefix,
      pkg.path || packageName,
      modulePath
    );
  }
}

/**
 * Returns the appliciable Scope for `referrerURL`, and its ancestors.
 *
 * TODO: A recursive algorithm might be easier to write spec text for.
 */
const getScopeContext = (rootScope: Scope, referrerURL: string) => {
  const scopeContext: ScopeEntry[] = [];

  let currentScope: Scope = rootScope;
  let currentScopePath = '';
  let currentScopePathPrefix = '';
  let foundChildScope = true;

  while (foundChildScope) {
    scopeContext.push({path: currentScopePath, scope: currentScope});
    foundChildScope = false;
    if (currentScope.scopes !== undefined) {
      for (const [childScopePrefix, childScope] of Object.entries(
        currentScope.scopes
      )) {
        const childScopeFullPrefix = joinPaths(
          currentScopePathPrefix,
          childScopePrefix
        );
        if (isPathSegmentPrefix(childScopeFullPrefix, referrerURL)) {
          currentScope = childScope;
          currentScopePath = childScopePrefix;
          currentScopePathPrefix = childScopeFullPrefix;
          foundChildScope = true;
          break;
        }
      }
    }
  }
  return scopeContext;
};

/**
 * Given a list of Scopes (ancestors from a root Scope to the target search
 * Scope) to search, finds a Package whose name is a PathSegmentPrefix of
 * `specifier`.
 *
 * Returns:
 *  - A sublist of the given Scope list that contains the scope that the package
 *    entry was found in, and its ancestors.
 *  - The found package
 *  - The found package name
 *
 * TODO: A recursive algorithm might be easier to write spec text for.
 */
const findPackage = (
  scopes: ScopeEntry[],
  specifier: string
): FindPackageResult => {
  let scopePathIndex = scopes.length - 1;
  let foundPackage: Package | undefined = undefined;
  let foundPackageName: string | undefined = undefined;

  do {
    const scope = scopes[scopePathIndex].scope;
    if (scope.packages !== undefined) {
      for (const [pkgName, pkg] of Object.entries(scope.packages)) {
        if (isPathSegmentPrefix(pkgName, specifier)) {
          foundPackage = pkg;
          foundPackageName = pkgName;
          break;
        }
      }
    }
  } while (foundPackage === undefined && --scopePathIndex >= 0);
  return {
    scopeContext: scopes.slice(0, scopePathIndex + 1),
    packageName: foundPackageName,
    package: foundPackage,
  };
};

/**
 * Joins together two or more strings, ensuring there's a '/' character
 * between each.
 */
const joinPaths = (...paths: Array<string | undefined>) => {
  let result = '';
  for (const path of paths) {
    if (path === undefined) {
      continue;
    }
    if (result !== '' && result[result.length - 1] !== '/' && path[0] !== '/') {
      result += '/';
    }
    result += path;
  }
  return result;
};

/**
 * Returns `true` iff `prefix` is a string prefix of `str` and `prefix` the rest
 * of `str` are separated by a path separator ('/').
 *
 * This means that either `prefix` must end with a path separator, or the rest
 * of `str` after removing `prefix` must begin with a path separator.
 *
 * Examples:
 *  - isPathSegmentPrefix('', 'a'): true
 *  - isPathSegmentPrefix('a', 'a'): true
 *  - isPathSegmentPrefix('a', 'a/b'): true
 *  - isPathSegmentPrefix('a/', 'a/b'): true
 *  - isPathSegmentPrefix('a', 'ab'): false
 *
 * Exported for testing only.
 */
export const isPathSegmentPrefix = (prefix: string, str: string): boolean => {
  return (
    prefix.length === 0 ||
    (str.startsWith(prefix) &&
      (prefix.length === str.length ||
        str[prefix.length] === '/' ||
        prefix[prefix.length - 1] === '/'))
  );
};

declare class URL {
  constructor(url: string, base?: string);
}

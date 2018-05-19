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
  /**
   * The absolute prefix URL to be applied to any path within the scope. This
   * includes this Scope's any ancestor's paths and path_prefixes.
   */
  prefixURL: string;

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
 * Performs initialization-time scope validation
 * Ensuring valid property types
 */
function validateScope(scope: Scope) {
  if (scope.path_prefix !== undefined && typeof scope.path_prefix !== 'string') {
    throw new Error(`path_prefix must be a valid string.`);
  }
  if (scope.packages !== undefined) {
    if (typeof scope.packages !== 'object') {
      throw new Error(`packages must be a valid object.`);
    }
    Object.entries(scope.packages).forEach(validatePackage);
  }
  if (scope.scopes !== undefined) {
    if (typeof scope.scopes !== 'object') {
      throw new Error(`scopes must be a valid object.`);
    }
    Object.values(scope.scopes).forEach(validateScope);
  }
}
function validatePackage([pkgName, pkg]: [string, Package]) {
  // package name validation
  if (pkgName.match(/(^|\/|\\)\.\.?[\/\\]/)) {
    throw new Error(
      `Invalid package name ${pkgName}, package names must not contain dot segments.`
    );
  }
  if (pkgName.match(/^\/\\|\/\\$/)) {
    throw new Error(
      `Invalid package name ${pkgName}, package names cannot start or end with a path separator.`
    );
  }
  if (pkgName.indexOf(':') !== -1 && isURL(pkgName)) {
    throw new Error(
      `Invalid package name ${pkgName}, package names cannot be URLs.`
    );
  }
  if (pkg.path !== undefined && typeof pkg.path !== 'string') {
    throw new Error(
      `Invalid package for ${pkgName}, path expected to be a string.`
    );
  }
  if (pkg.main !== undefined && typeof pkg.main !== 'string') {
    throw new Error(
      `Invalid package for ${pkgName}, main expected to be a string.`
    );
  }
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
  private baseURL: string;
  private _map: Scope;

  constructor(map: Scope, baseURL: string) {
    validateScope(map);
    this._map = map;
    this.baseURL = new URL('.', baseURL).href;
  }

  resolve(specifier: string, referrerURL: string): string {
    // 1. If specifier parses as absolute URL, return the specifier.
    try {
      return new URL(specifier).href;
    } catch (e) {}

    // 2. If specifier starts with `./`, `../`,  or `/`, return the specifier
    //    resolved from the referrerURL.
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, referrerURL).href;
    }

    // 3. Find the applicable scope based on referrerURL.
    const initialScopeContext = getScopeContext(
      this._map,
      referrerURL,
      this.baseURL
    );

    // 4. Find the package entry.
    const {scopeContext, packageName, package: pkg} = findPackage(
      initialScopeContext,
      specifier
    );

    // 5. If no package entry is found, throw an error.
    if (pkg === undefined) {
      throw new Error(
        `Unable to resolve specifier ${specifier} from referrer ${referrerURL}`
      );
    }

    // 6. If the specifier is to a sub-module, but the package doesn't have a
    //    path, throw an error.
    if (specifier !== packageName && pkg.path === undefined) {
      throw new Error(
        `Cannot resolve specifier, no path found for package ${packageName}`
      );
    }

    // 7. Get the full path prefix of the scope containing the found package
    const packagePathPrefix = scopeContext[scopeContext.length - 1].prefixURL;

    // 8. Compute package-relative path of the module.
    //
    // If the specifier is fully "bare" (it's only a package name), then use
    // the Package's main file, otherwise remove the package name from the
    // specifier to get the package-internal path to the module.
    const packageRelativeModulePath =
      specifier === packageName
        ? pkg.main
        : specifier.substring(packageName!.length + 1);

    // 9. Return the resolved URL built from: the baseURL, the scope's prefix,
    //    the package's path, and the package-relative path of the module.
    return resolveURL(
      this.baseURL,
      packagePathPrefix,
      ensureTrailingSlash(pkg.path || packageName!),
      packageRelativeModulePath
    );
  }
}

/**
 * Returns true iff `s` parses as a URL.
 */
const isURL = (s: string): boolean => {
  try {
    new URL(s);
    return true;
  } catch (e) {
    return false;
  }
};

const ensureTrailingSlash = (s: string) => (s.length === 0 || s.endsWith('/') ? s : s + '/');

/**
 * Performs successive URL resolution of fragments.
 */
const resolveURL = (...fragments: Array<string>) => {
  return fragments.reduce((p, c) => new URL(c, p).href);
};

/**
 * Returns the appliciable Scope for `referrerURL`, and its ancestors.
 *
 * TODO: A recursive algorithm might be easier to write spec text for.
 */
const getScopeContext = (
  rootScope: Scope,
  referrerURL: string,
  baseURL: string
) => {
  const scopeContext: ScopeEntry[] = [];

  let currentScopeEntry: ScopeEntry | undefined = {
    prefixURL: resolveURL(
      baseURL,
      rootScope.path_prefix !== undefined
        ? ensureTrailingSlash(rootScope.path_prefix)
        : ''
    ),
    scope: rootScope,
  };

  while (currentScopeEntry !== undefined) {
    scopeContext.push(currentScopeEntry);
    const {scope, prefixURL}: ScopeEntry = currentScopeEntry;
    currentScopeEntry = undefined;
    if (scope.scopes !== undefined) {
      const childScopes = Object.entries(scope.scopes);
      for (const [childScopePrefix, childScope] of childScopes) {
        const childScopeFullPrefix = resolveURL(
          prefixURL,
          ensureTrailingSlash(childScopePrefix)
        );
        if (isPathSegmentPrefix(childScopeFullPrefix, referrerURL)) {
          currentScopeEntry = {
            scope: childScope,
            prefixURL: resolveURL(
              childScopeFullPrefix,
              childScope.path_prefix !== undefined
                ? ensureTrailingSlash(childScope.path_prefix)
                : ''
            ),
          };
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
    if (scope.packages) {
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
 * Returns true iff `prefix` is a string prefix of `str` and `prefix` and the
 * rest of `str` and `prefix` are separated by a path separator ('/').
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
  const result =
    prefix.length === 0 ||
    (str.startsWith(prefix) &&
      (prefix.length === str.length ||
        str[prefix.length] === '/' ||
        prefix[prefix.length - 1] === '/'));
  return result;
};

declare class URL {
  constructor(url: string, base?: string);
  readonly href: string;
}

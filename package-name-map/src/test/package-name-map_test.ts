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

import chai = require('chai');

import {PackageNameMap, isPathSegmentPrefix} from '../package-name-map.js';

const {assert} = chai;

suite('PackageNameMap', () => {
  suite('resolve', () => {
    const referrerURL = 'http://foo.com/';

    suite('does not modify already valid specifiers', () => {
      const map = new PackageNameMap({
        packages: {
          foo: {
            main: 'index.js',
          },
        },
      });

      test('does not modify URLs', () => {
        assert.equal(
          map.resolve('https://bar.com', referrerURL),
          'https://bar.com'
        );
      });

      test('does not modify valid paths', () => {
        assert.equal(map.resolve('/foo', referrerURL), '/foo');
        assert.equal(map.resolve('./foo', referrerURL), './foo');
        assert.equal(map.resolve('../foo', referrerURL), '../foo');
      });
    });

    suite('top-level package names', () => {
      const map = new PackageNameMap({
        packages: {
          app: {
            main: 'src/index.js',
          },
          lodash: {
            path: '/node_modules/lodash-es',
            main: 'lodash.js',
          },
          '@polymer/polymer': {
            path: '/node_modules/@polymer/polymer',
            main: 'polymer.js',
          },
          '@polymer/polymer-foo': {
            path: '/node_modules/@polymer/polymer-foo',
            main: 'polymer-foo.js',
          },
        },
      });

      test('resolves package name for a package with only a main', () => {
        assert.equal(map.resolve('app', referrerURL), 'app/src/index.js');
      });

      test('resolves package name for a package with a path and main', () => {
        assert.equal(
          map.resolve('lodash', referrerURL),
          '/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves a submodule for package with a path and main', () => {
        assert.equal(
          map.resolve('lodash/bar.js', referrerURL),
          '/node_modules/lodash-es/bar.js'
        );
      });

      test('resolves a "scoped" package name', () => {
        assert.equal(
          map.resolve('@polymer/polymer', referrerURL),
          '/node_modules/@polymer/polymer/polymer.js'
        );
      });

      test('resolves a package name with another name as a prefix', () => {
        assert.equal(
          map.resolve('@polymer/polymer-foo', referrerURL),
          '/node_modules/@polymer/polymer-foo/polymer-foo.js'
        );
      });

      test('errors for a submodule with only a main', () => {
        assert.throws(() => map.resolve('app/foo.js', referrerURL));
      });
    });

    suite('path_prefix', () => {
      const map = new PackageNameMap({
        path_prefix: '/node_modules',
        packages: {
          moment: {
            main: 'moment.js',
          },
          lodash: {
            path: 'lodash-es',
            main: 'lodash.js',
          },
          '@polymer/polymer': {
            path: '@polymer/polymer',
            main: 'polymer.js',
          },
        },
      });

      test('resolves package name for a package with only a main', () => {
        assert.equal(
          map.resolve('moment', referrerURL),
          '/node_modules/moment/moment.js'
        );
      });

      test('resolves package name for a package with a path and main', () => {
        assert.equal(
          map.resolve('lodash', referrerURL),
          '/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves a submodule for package with a path and main', () => {
        assert.equal(
          map.resolve('lodash/bar.js', referrerURL),
          '/node_modules/lodash-es/bar.js'
        );
      });

      test('resolves a "scoped" package name', () => {
        assert.equal(
          map.resolve('@polymer/polymer', referrerURL),
          '/node_modules/@polymer/polymer/polymer.js'
        );
      });
    });

    suite('scopes', () => {
      const map = new PackageNameMap({
        packages: {
          moment: {
            main: 'fail.js',
          },
          lodash: {
            path: '/node_modules/lodash-es',
            main: 'lodash.js',
          },
        },
        scopes: {
          '/node_modules/lodash-es': {
            path_prefix: 'node_modules',
            packages: {
              moment: {
                main: 'moment.js',
              },
            },
            scopes: {
              subpackage: {
                packages: {
                  'not-moment': {
                    main: 'index.js',
                  },
                },
              },
            },
          },
        },
      });

      test('resolves package names in scopes', () => {
        assert.equal(
          map.resolve('moment', '/node_modules/lodash-es/lodash.js'),
          '/node_modules/lodash-es/node_modules/moment/moment.js'
        );
      });

      test('resolves package names in outer scopes', () => {
        assert.equal(
          map.resolve('lodash', '/node_modules/lodash-es/lodash.js'),
          '/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves package names in outer scopes from deeper scopes', () => {
        assert.equal(
          map.resolve('moment', '/node_modules/lodash-es/subpackage'),
          '/node_modules/lodash-es/node_modules/moment/moment.js'
        );
      });
    });
  });
});

suite('isPathSegmentPrefix', () => {
  test('returns true for equal strings', () => {
    assert.isTrue(isPathSegmentPrefix('a', 'a'));
  });

  test('returns true for an empty prefix', () => {
    assert.isTrue(isPathSegmentPrefix('', 'a'));
  });

  test('returns true for a path segment prefix', () => {
    assert.isTrue(isPathSegmentPrefix('a', 'a/b'));
    assert.isTrue(isPathSegmentPrefix('a/', 'a/b'));
  });

  test('returns false for a non-path segment prefix', () => {
    assert.isFalse(isPathSegmentPrefix('a', 'ab'));
    assert.isFalse(isPathSegmentPrefix('a', 'ab/c'));
  });
});

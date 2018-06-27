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
    const referrerURL = 'http://bar.com/bar/baz.html';
    const baseURL = 'http://foo.com/resources/package-name-map.json';

    suite('does not modify already valid specifiers', () => {
      const map = new PackageNameMap(
        {
          packages: {
            foo: {
              main: 'index.js',
            },
          },
        },
        baseURL
      );

      test('does not modify URLs', () => {
        assert.equal(
          map.resolve('https://bar.com', referrerURL),
          'https://bar.com/'
        );
      });

      test('does not modify valid paths', () => {
        assert.equal(map.resolve('/foo', referrerURL), 'http://bar.com/foo');
        assert.equal(
          map.resolve('./foo', referrerURL),
          'http://bar.com/bar/foo'
        );
        assert.equal(map.resolve('./foo', referrerURL), 'http://bar.com/bar/foo');
        assert.equal(map.resolve('../foo', referrerURL), 'http://bar.com/foo');
      });
    });

    suite('top-level package names', () => {
      const map = new PackageNameMap(
        {
          packages: {
            app: {
              main: 'src/index.js',
            },
            lodash: {
              path: '/node_modules/lodash-es',
              main: 'lodash.js',
            },
            relative: {
              path: 'node_modules/relative',
              main: 'relative.js',
            },
            '@polymer/polymer': {
              path: '/node_modules/@polymer/polymer',
              main: 'polymer.js',
            },
            '@polymer/polymer-foo': {
              path: '/node_modules/@polymer/polymer-foo',
              main: 'polymer-foo.js',
            },
          }
        },
        baseURL
      );

      test('resolves package name for a package with only a main', () => {
        assert.equal(
          map.resolve('app', referrerURL),
          'http://foo.com/resources/app/src/index.js'
        );
      });

      test('uses the default path for a package with only a main', () => {
        assert.equal(map.resolve('app/foo.js', referrerURL), 'http://foo.com/resources/app/foo.js');
      });

      test('resolves package name for a package with an absolute path and main', () => {
        assert.equal(
          map.resolve('lodash', referrerURL),
          'http://foo.com/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves a submodule for package with an absolute path and main', () => {
        assert.equal(
          map.resolve('lodash/bar.js', referrerURL),
          'http://foo.com/node_modules/lodash-es/bar.js'
        );
      });

      test('resolves package name for a package with a relative path and main', () => {
        assert.equal(
          map.resolve('relative', referrerURL),
          'http://foo.com/resources/node_modules/relative/relative.js'
        );
      });

      test('resolves a submodule for package with a relative path and main', () => {
        assert.equal(
          map.resolve('relative/bar.js', referrerURL),
          'http://foo.com/resources/node_modules/relative/bar.js'
        );
      });

      test('resolves a "scoped" package name', () => {
        assert.equal(
          map.resolve('@polymer/polymer', referrerURL),
          'http://foo.com/node_modules/@polymer/polymer/polymer.js'
        );
      });

      test('resolves a package name with another name as a prefix', () => {
        assert.equal(
          map.resolve('@polymer/polymer-foo', referrerURL),
          'http://foo.com/node_modules/@polymer/polymer-foo/polymer-foo.js'
        );
      });
    });

    suite('package main variations', () => {
      const map = new PackageNameMap(
        {
          path_prefix: '/node_modules',
          packages: {
            lodash: '/lodash.js',
            'lodash-es': {},
            moment: {
              main: 'http://moment.com/moment.js'
            },
            '@polymer/polymer': 'index.js',
            '@polymer/polymer-foo': {
              main: '../polymer-foo.js'
            }
          }
        },
        baseURL
      );

      test('supports package string case for main', () => {
        assert.equal(map.resolve('lodash', referrerURL), 'http://foo.com/lodash.js');
      });

      test('package string case for submodules errors', () => {
        assert.equal(map.resolve('lodash/x', referrerURL), 'http://foo.com/node_modules/lodash/x');
      });

      test('package empty object case for main', () => {
        try {
          map.resolve('lodash-es', referrerURL);
          assert.fail('Should error');
        }
        catch (e) {
          assert.equal(e.message, 'Cannot resolve specifier lodash-es, no main found for package lodash-es');
        }
      });

      test('package empty object case for submodules', () => {
        assert.equal(map.resolve('lodash-es/x', referrerURL), 'http://foo.com/node_modules/lodash-es/x');
      });

      test('supports URL main', () => {
        assert.equal(map.resolve('moment', referrerURL), 'http://moment.com/moment.js');
      });

      test('supports relative main sugar', () => {
        assert.equal(map.resolve('@polymer/polymer', referrerURL), 'http://foo.com/node_modules/@polymer/polymer/index.js');
      });

      test('supports relative URL main', () => {
        assert.equal(map.resolve('@polymer/polymer-foo', referrerURL), 'http://foo.com/node_modules/@polymer/polymer-foo.js');
      });
    });

    suite('path_prefix', () => {
      const map = new PackageNameMap(
        {
          path_prefix: '/node_modules',
          packages: {
            moment: {
              main: 'moment.js',
            },
            lodash: {
              path: 'lodash-es',
              main: 'lodash.js',
            },
            'lodash-es': {
              path: 'lodash-es'
            },
            '@polymer/polymer': {
              path: '@polymer/polymer',
              main: 'polymer.js',
            },
          },
        },
        baseURL
      );

      test('resolves package name for a package with only a main', () => {
        assert.equal(
          map.resolve('moment', referrerURL),
          'http://foo.com/node_modules/moment/moment.js'
        );
      });

      test('resolves package name for a package with a path and main', () => {
        assert.equal(
          map.resolve('lodash', referrerURL),
          'http://foo.com/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves a submodule for package with a path and main', () => {
        assert.equal(
          map.resolve('lodash/bar.js', referrerURL),
          'http://foo.com/node_modules/lodash-es/bar.js'
        );
      });

      test('throws resolving main for a package with only a path', () => {
        try {
          map.resolve('lodash-es', referrerURL);
          assert.fail();
        }
        catch (err) {
          assert.equal(err.message, 'Cannot resolve specifier lodash-es, no main found for package lodash-es');
        }
      });

      test('resolves a submodule for a package with only a path', () => {
        assert.equal(
          map.resolve('lodash-es/bar.js', referrerURL),
          'http://foo.com/node_modules/lodash-es/bar.js'
        );
      });

      test('resolves a "scoped" package name', () => {
        assert.equal(
          map.resolve('@polymer/polymer', referrerURL),
          'http://foo.com/node_modules/@polymer/polymer/polymer.js'
        );
      });
    });

    suite('scopes', () => {
      const map = new PackageNameMap(
        {
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
            'node_modules/lodash-es': {
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
        },
        baseURL
      );

      test('resolves package names in scopes', () => {
        assert.equal(
          map.resolve(
            'moment',
            'http://foo.com/resources/node_modules/lodash-es/lodash.js'
          ),
          'http://foo.com/resources/node_modules/lodash-es/node_modules/moment/moment.js'
        );
      });

      test('resolves package names in deeper scopes', () => {
        assert.equal(
          map.resolve(
            'not-moment',
            'http://foo.com/resources/node_modules/lodash-es/node_modules/subpackage/foo.js'
          ),
          'http://foo.com/resources/node_modules/lodash-es/node_modules/subpackage/not-moment/index.js'
        );
      });

      test('resolves package names in outer scopes', () => {
        assert.equal(
          map.resolve(
            'lodash',
            'http://foo.com/resources/node_modules/lodash-es/lodash.js'
          ),
          'http://foo.com/node_modules/lodash-es/lodash.js'
        );
      });

      test('resolves package names in outer scopes from deeper scopes', () => {
        assert.equal(
          map.resolve(
            'moment',
            'http://foo.com/resources/node_modules/lodash-es/subpackage'
          ),
          'http://foo.com/resources/node_modules/lodash-es/node_modules/moment/moment.js'
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

suite('some pathological cases', () => {

  const referrerURL = 'http://foo.com/bar/baz.html';
  const baseURL = 'http://foo.com/resources/package-name-map.json';

  suite('package map init validations', () => {
    test('Invalid path_prefix type', () => {
      try {
        new PackageNameMap(
          {
            scopes: {
              '/': {
                path_prefix: <any>0,
                packages: {
                  'moment': {
                    main: 'moment.js',
                  },
                },
              },
            },
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, 'path_prefix must be a valid string.');
      }
    });

    test('Invalid packages type', () => {
      try {
        new PackageNameMap(
          {
            scopes: {
              '/': {
                path_prefix: 'node_modules',
                packages: <any>'blah'
              },
            },
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, 'packages must be a valid object.');
      }
    });

    test('Invalid scopes type', () => {
      try {
        new PackageNameMap(
          {
            scopes: <any>'asdf'
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, 'scopes must be a valid object.');
      }
    });

    test('Invalid path', () => {
      try {
        new PackageNameMap(
          {
            path_prefix: '/node_modules',
            packages: {
              'moment': {
                path: <any>1,
                main: 'moment.js',
              },
            },
          },
          baseURL
        );    
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, `Invalid package for moment, path expected to be a string.`);
      }
    });

    test('Invalid main', () => {
      try {
        new PackageNameMap(
          {
            path_prefix: '/node_modules',
            packages: {
              'moment': {
                main: <any>1,
              },
            },
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, `Invalid package for moment, main expected to be a string.`);
      }
    });
  });

  suite('scopes', () => {
    test('empty string scope', () => {
      const map = new PackageNameMap(
        {
          scopes: {
            '': {
              path_prefix: 'node_modules',
              packages: {
                'moment': {
                  main: 'moment.js',
                },
              },
            },
          },
        },
        referrerURL
      );
    
      assert.equal(map.resolve('moment', referrerURL), 'http://foo.com/bar/node_modules/moment/moment.js');
    });
  });

  suite('package name validations', () => {
    test('dot segments at start of package name', () => {
      const map = new PackageNameMap(
        {
          path_prefix: '/node_modules',
          packages: {
            '..\\moment': {
              main: 'moment.js',
            },
          },
        },
        referrerURL
      );
      assert.equal(map.resolve('..\\moment', referrerURL), 'http://foo.com/moment/moment.js');
    });

    test('dot segments and separator at start of package name', () => {
      const map = new PackageNameMap(
        {
          path_prefix: 'baz',
          packages: {
            '..\\/moment': {
              main: 'moment.js',
            },
          },
        },
        referrerURL
      );
      assert.equal(map.resolve('..\\/moment', referrerURL), 'http://foo.com/bar//moment/moment.js');
    });

    test('dot segments within package name', () => {
      const map = new PackageNameMap(
        {
          path_prefix: '/node_modules',
          packages: {
            'moment/../notmoment': {
              main: 'moment.js',
            },
          },
        },
        baseURL
      );
      assert.equal(map.resolve('moment/../notmoment', referrerURL), 'http://foo.com/node_modules/notmoment/moment.js');
    });

    test('trailing slash', () => {
      try {
        new PackageNameMap(
          {
            path_prefix: '/node_modules',
            packages: {
              'moment/': {
                path: 'y',
                main: 'moment.js',
              },
            },
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, `Invalid package name moment/, package names cannot start or end with a path separator.`);
      }
    });

    test('leading slash', () => {
      try {
        new PackageNameMap(
          {
            path_prefix: '/node_modules',
            packages: {
              '/moment': {
                path: 'y',
                main: 'moment.js',
              },
            },
          },
          baseURL
        );
        assert.fail();
      }
      catch (err) {
        assert.equal(err.message, `Invalid package name /moment, package names cannot start or end with a path separator.`);
      }
    });

    test('url', () => {
      const map = new PackageNameMap(
        {
          path_prefix: '/node_modules',
          packages: {
            'http://foo.com/pkg': {
              path: 'y',
              main: 'moment.js',
            },
          },
        },
        baseURL
      );
      assert.equal(map.resolve('http://foo.com/pkg', referrerURL), 'http://foo.com/pkg');
    });
  });
});
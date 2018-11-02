# Import maps

_Or, how to control the behavior of JavaScript imports_

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of contents

- [The basic idea](#the-basic-idea)
- [Background](#background)
  - [Bare specifiers](#bare-specifiers)
  - [Built-in modules](#built-in-modules)
- [The import map](#the-import-map)
  - [`import:` URLs](#import-urls)
  - [Bare specifier examples](#bare-specifier-examples)
    - [Bare specifiers for JavaScript modules](#bare-specifiers-for-javascript-modules)
    - [Bare specifiers for other resources](#bare-specifiers-for-other-resources)
    - ["Packages" via trailing slashes](#packages-via-trailing-slashes)
  - [Fallback examples](#fallback-examples)
    - [For user-supplied packages](#for-user-supplied-packages)
    - [For built-in modules, in module-import-map-supporting browsers](#for-built-in-modules-in-module-import-map-supporting-browsers)
    - [For built-in modules, in browsers without import maps](#for-built-in-modules-in-browsers-without-import-maps)
      - [This doesn't work for `<script>`](#this-doesnt-work-for-script)
  - [Scoping examples](#scoping-examples)
    - [Multiple versions of the same module](#multiple-versions-of-the-same-module)
    - [Scope inheritance](#scope-inheritance)
  - [Virtualization examples](#virtualization-examples)
    - [Denying access to a built-in module](#denying-access-to-a-built-in-module)
    - [Selective denial](#selective-denial)
    - [Wrapping a built-in module](#wrapping-a-built-in-module)
    - [Extending a built-in module](#extending-a-built-in-module)
- [Import map processing](#import-map-processing)
  - [Installation](#installation)
  - [Scope](#scope)
- [Alternatives considered](#alternatives-considered)
  - [The Node.js module resolution algorithm](#the-nodejs-module-resolution-algorithm)
  - [A programmable resolution hook](#a-programmable-resolution-hook)
  - [Ahead-of-time rewriting](#ahead-of-time-rewriting)
  - [Service workers](#service-workers)
  - [A convention-based flat mapping](#a-convention-based-flat-mapping)
- [Adjacent concepts](#adjacent-concepts)
  - [Supplying out-of-band metadata for each module](#supplying-out-of-band-metadata-for-each-module)
  - [Module-relative URL resolution](#module-relative-url-resolution)
- [Implementation notes](#implementation-notes)
  - [`import:` URL staging](#import-url-staging)
  - [Further implementation staging](#further-implementation-staging)
  - [`import:` URL loads and origins](#import-url-loads-and-origins)
  - [`import:` URL interaction with other loading infrastructure](#import-url-interaction-with-other-loading-infrastructure)
- [Acknowledgments](#acknowledgments)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## The basic idea

This proposal allows control over what URLs get fetched by JavaScript `import` statements and `import()` expressions, and allows this mapping to be reused in non-import contexts. This solves a variety of important use cases, such as:

- Allowing "bare import specifiers", such as `import moment from "moment"`, to work

- Providing fallback resolution, so that `import $ from "jquery"` can try to go to a CDN first, but fall back to a local version if the CDN server is down

- Enabling polyfilling of, or other control over, [built-in modules](https://github.com/tc39/proposal-javascript-standard-library/)

- Sharing the notion of a "package" between JavaScript importing contexts and traditional URL contexts, such as `fetch()`, `<img src="">` or `<link href="">`

The mechanism for doing this is via a new `import:` URL scheme, plus an _import map_ which can be used to control the resolution of `import:` URLs. As an introductory example, consider the code

```js
import moment from "moment";
import { partition } from "lodash";
```

Today, this throws, as such bare specifiers [are explicitly reserved](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier). By supplying the browser with the following import map

```json
{
  "modules": {
    "moment": "/node_modules/moment/src/moment.js",
    "lodash": "/node_modules/lodash-es/lodash.js"
  }
}
```

the above would act as if you had written

```js
import moment from "/node_modules/moment/src/moment.js";
import { partition } from "/node_modules/lodash-es/lodash.js";
```

You would also be able to use these mappings in other contexts via the `import:` URL scheme, e.g.

```html
<link rel="modulepreload" href="import:lodash">
```

## Background

### Bare specifiers

Web developers with experience with pre-ES2015 module systems, such as CommonJS (either in Node or bundled using webpack/browserify for the browser), are used to being able to import modules using a simple syntax:

```js
const $ = require("jquery");
const { pluck } = require("lodash");
```

Translated into the language of JavaScript's built-in module system, these would be

```js
import $ from "jquery";
import { pluck } from "lodash";
```

In such systems, these bare import specifiers of `"jquery"` or `"lodash"` are mapped to full filenames or URLs. In more detail, these specifiers represent _packages_, usually distributed on [npm](https://www.npmjs.com/); by only specifying the name of the package, they are implicitly requesting the main module of that package.

The main benefit of this system is that it allows easy coordination across the ecosystem. Anyone can write a module and include an import statement using a package's well-known name, and let the Node.js runtime or their build-time tooling take care of translating it into an actual file on disk (including figuring out versioning considerations).

Today, many web developers are even using JavaScript's native module syntax, but combining it with bare import specifiers, thus making their code unable to run on the web without per-application, ahead-of-time modification. We'd like to solve that, and bring these benefits to the web.

### Built-in modules

When considering the introduction of [built-in modules](https://github.com/tc39/proposal-javascript-standard-library/) to the web, we need to ensure that we do not lose any of the important features we have today when introducing features via new globals. Notably, these include:

- Polyfilling: the ability to supply a polyfill module that acts as the built-in one
- Virtualization: the ability to wrap, extend, or remove access to the built-in module

Both of these capabilities are easy to achieve with globals, but without some mechanism for modifying module resolution, they are not possible for modules (including built-in modules). The import maps proposal provides that mechanism.

Note that these use cases are complicated by the need to support browsers without import map support. More on that below.

## The import map

### `import:` URLs

`import:` is a new URL scheme which is reserved for purposes related to JavaScript module resolution. As non-[special](https://url.spec.whatwg.org/#special-scheme) URLs, `import:` URLs just consist of two parts: the leading `import:`, and the following [path](https://url.spec.whatwg.org/#concept-url-path) component. (This is the same as `blob:` or `data:` URLs.)

The behavior of `import:` URLs is controlled by the _import map_, which is a JSON structure that gives a declarative way of modifying the resolution of `import:` URLs, per the above algorithm. (If you are surprised by the use of a declarative solution, you may want to briefly visit the ["Alternatives considered"](#alternatives-considered) section to read up on why we think this is the best path.)

In addition to being usable in all the places a URL normally is available, such as `fetch()`, `<link>`, `<img>`, etc., `import:` URLs are also made to underpin specifier resolution into JavaScript modules. That is, any import statements such as

```js
// URL-like specifiers:
import "./x";
import "../y";
import "/z";

// Bare specifier:
import "w";
```

will resolve the URLs `import:./x`, `import:../y`, `import:/z`, and `import:w`, using the import map where applicable. This means import maps have complete control over specifier resolution—both "bare" and "URL-like".

In other words, `import` statements and `import()` expressions are now much more like every other part of the platform that loads resources, e.g. `fetch()` or `<script src="">`: they operate on URLs. The only difference is that, for convenience, you omit the leading `import:`.

_What happens if you do `import "import:x"`? To be determined. We could make it fail, or make it recurse._

We explain the features of the import map via a series of examples.

### Bare specifier examples

#### Bare specifiers for JavaScript modules

As mentioned in the introduction,

```json
{
  "modules": {
    "moment": "/node_modules/moment/src/moment.js",
    "lodash": "/node_modules/lodash-es/lodash.js"
  }
}
```

gives bare import specifier support in JavaScript code:

```js
import moment from "moment";
import("lodash").then(_ => ...);
```

and in HTML:

```html
<link rel="modulepreload" href="import:moment">
```

Note that the right-hand side of the mapping must start with `/`, `../`, or `./` to identify a URL. (Other cases are explained [later](#for-built-in-modules-in-module-import-map-supporting-browsers).)

#### Bare specifiers for other resources

Because `import:` URLs can be used anywhere, they aren't only applicable to JavaScript imports. For example, consider a widget package that contains not only a JavaScript module, but also CSS themes, and corresponding images. You could configure a import map like

```json
{
  "modules": {
    "widget": "/node_modules/widget/index.mjs",
    "widget-light": "/node_modules/widget/themes/light.css",
    "widget-back-button": "/node_modules/widget/assets/back.svg"
  }
}
```

and then do

```html
<link rel="stylesheet" href="import:widget-light">
<script type="module" src="import:widget"></script>
```

or

```css
.back-button {
  background: url('import:widget-back-button');
}
```

Things brings the name-coordination benefits of JavaScript's bare import specifiers to all web resources.

(Does this use of separate `widget`, `widget-light`, and `widget-back-button` entries seem weird to you? Does it seem like they'd be better grouped under some sort of "package"? Read on to our next example...)

#### "Packages" via trailing slashes

It's common in the JavaScript ecosystem to have a package (in the sense of [npm](https://www.npmjs.com/)) contain multiple modules, or other files. For such cases, we want to map a prefix in the `import:`-URL space, onto another prefix in the fetchable-URL space.

Import maps do this by giving special meaning to mappings that end with a trailing slash. Thus, a map like

```json
{
  "modules": {
    "moment": "/node_modules/moment/src/moment.js",
    "moment/": "/node_modules/moment/src/",
    "lodash": "/node_modules/lodash-es/lodash.js",
    "lodash/": "/node_modules/lodash-es/"
  }
}
```

would allow not only importing the main modules like

```js
import moment from "moment";
import _ from "lodash";
```

but also non-main modules, e.g.

```js
import localeData from "moment/locale/zh-cn.js";
import fp from "lodash/fp.js";
```

_Note how unlike some Node.js usages, we include the ending `.js` here. File extensions are required in browsers; unlike in Node, [we do not have the luxury](#the-nodejs-module-resolution-algorithm) of trying multiple file extensions until we find a good match. Fortunately, including file extensions also works in Node.js; that is, if everyone uses file extensions for submodules, their code will work in both environments._

As usual, since the import map affects `import:` resolution generally, this package concept can be used for other resources, and in other contexts.

<details>
<summary>Here's our previous example converted to use packages:</summary>

```json
{
  "modules": {
    "widget": "/node_modules/widget/index.mjs",
    "widget/": "/node_modules/widget/"
  }
}
```

```html
<link rel="stylesheet" href="import:widget/themes/light.css">
<script type="module" src="import:widget"></script>
```

```css
.back-button {
  background: url('import:widget/assets/back.svg');
}
```
</details>

### Fallback examples

#### For user-supplied packages

Consider the case of wanting to use a CDN's copy of a library, but fall back to a local copy if the CDN is unavailable. Today this is often accomplished via [terrible `document.write()`-using sync-script-loading hacks](https://www.hanselman.com/blog/CDNsFailButYourScriptsDontHaveToFallbackFromCDNToLocalJQuery.aspx). With import maps providing a first-class way of controlling module resolution, we can do better.

To provide fallbacks, use an array instead of a string for the right-hand side of your mapping:

```json
{
  "modules": {
    "jquery": [
      "https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js",
      "/node_modules/jquery/dist/jquery.js"
    ]
  }
}
```

In this case, any references to `import:jquery` will first try to fetch the CDN URL, but if that fails, fall back to the copy in `/node_modules/`. (This fallback process will happen only once, and the choice will be cached for all future `import:` URL resolutions.)

#### For built-in modules, in module-import-map-supporting browsers

When a browser supports import maps, we can use the same principle as the above example to support fallbacks for built-in modules.

For example, consider the following package name map, which supplies a polyfill fallback for [async local storage](https://domenic.github.io/async-local-storage/):

```json
{
  "modules": {
    "@std/async-local-storage": [
      "@std/async-local-storage",
      "/node_modules/als-polyfill/index.mjs"
    ]
  }
}
```

Note here how we see our first example of the right-hand side not starting with `./`, `../`, or `/`. If the right-hand side does not start with those prefixes, then it is interpreted as identifying a built-in module.

Now, statements like

```js
import { StorageArea } from "@std/async-local-storage";
```

will first try to resolve to `@std/async-local-storage`, i.e. the browser's built-in implementation of async local storage. If fetching that URL fails, because the browser does not implement async local storage, then instead it will fetch the polyfill, at `/node_modules/als-polyfill/index.mjs`.

#### For built-in modules, in browsers without import maps

The goal of the previous example is to use a polyfill in older browsers, but the built-in module in newer browsers. But it falls down in the case of browsers that are old enough to not support import maps at all. (That is, all of today's currently-shipping browsers.) In such cases, the statement `import { StorageArea } from "@std/async-local-storage"` will always fail, with no chance to remap it.

How can we write code that uses a polyfill in today's browsers, but uses built-in modules in future browsers that support them? We do this by changing our import statement to import the _polyfill_'s URL:

```js
import { StorageArea } from "/node_modules/als-polyfill/index.mjs";
```

and then remapping the polyfill to the built-in module for module-import-map-supporting browsers:

```json
{
  "modules": {
    "/node_modules/als-polyfill/index.mjs": [
      "@std/async-local-storage",
      "/node_modules/als-polyfill/index.mjs"
    ]
  }
}
```

With this mapping, each class of browser behaves as desired, for our above import statement:

- Browsers that do not support import maps will receive the polyfill.
- Browsers that support import maps, but do not support async local storage, will end up with a mapping from the polyfill URL to itself, and so will receive the polyfill anyway.
- Browsers that support both import maps and async local storage will end up with a mapping from the polyfill URL to `@std/async-local-storage`, and so will receive the built-in module.

Note how we're using a capability here that we haven't explored in previous examples: remapping imports of "URL-like" specifiers, not just bare specifiers. But it works exactly the same. Previous examples changed the resolution of URLs like `import:lodash`, and thus changed the meaning of `import "lodash"`. Here we're changing the resolution of `import:/node_modules/als-polyfill/index.mjs`, and thus changing the meaning of `import "/node_modules/als-polyfill/index.mjs"`.

##### This doesn't work for `<script>`

An important caveat to the above example is that it does _not_ help for `<script src="">` scenarios. That is, while

```js
import "/node_modules/als-polyfill/index.mjs";
```

would have the correct behavior (using the built-in version when appropriate) in all classes of browser,

```html
<script type="module" src="/node_modules/als-polyfill/index.mjs"></script>
```

would not: in all classes of browsers, it would fetch the polyfill unconditionally. What _would_ work, in import-map-supporting browsers, would be

```html
<script type="module" src="import:/node_modules/als-polyfill/index.mjs"></script>
```

But alas, in browsers without support for import maps, this will result in a network error. Thus, for side-effecting modules, you'd instead want to use the pattern

```html
<script type="module">import "/node_modules/als-polyfill/index.mjs";</script>
```

which will work as desired in all classes of browser.

### Scoping examples

#### Multiple versions of the same module

It is often the case that you want to use the same import specifier to refer to multiple versions of a single library, depending on who is importing them. This encapsulates the versions of each dependency in use, and avoids [dependency hell](http://npm.github.io/how-npm-works-docs/theory-and-design/dependency-hell.html) ([longer blog post](http://blog.timoxley.com/post/20772365842/node-js-npm-reducing-dependency-overheads)).

We support this use case in import maps by allowing you to change the meaning of a specifier within a given _scope_:

```json
{
  "modules": {
    "querystringify": "/node_modules/querystringify/index.js"
  },
  "scopes": {
    "/node_modules/socksjs-client/": {
      "querystringify": "/node_modules/socksjs-client/querystringify/index.js"
    }
  }
}
```

(This is example is one of several [in-the-wild examples](https://github.com/domenic/package-name-maps/issues/5#issuecomment-374175653) of multiple versions per application provided by @zkat. Thanks, @zkat!)

With this mapping, inside any modules whose URLs start with `/node_modules/socksjs-client/`, the `import:querystringify` URL will refer to `/node_modules/socksjs-client/querystringify/index.js`. Whereas otherwise, the top-level mapping will ensure that `import:querystringify` refers to `/node_modules/querystringify/index.js`.

_Note: this sensitivity to the current script file in URL parsing is novel, and requires changes to the URL parser. See [the proto-spec](./spec.md#resolution) for details._

#### Scope inheritance

Scopes "inherit" from each other in an intentionally-simple manner, merging but overriding as they go. For example, the following package name map:

```json
{
  "modules": {
    "a": "/a-1.mjs",
    "b": "/b-1.mjs",
    "c": "/c-1.mjs"
  },
  "scopes": {
    "/scope2/": {
      "a": "/a-2.mjs"
    },
    "/scope2/scope3/": {
      "a": "/a-3.mjs",
      "b": "/b-3.mjs"
    }
  }
}
```

would give the following resolutions:

|Specifier|Referrer               |Resulting URL |
|---------|-----------------------|--------------|
|a        |/scope1/foo.mjs        |/a-1.mjs      |
|b        |/scope1/foo.mjs        |/b-1.mjs      |
|c        |/scope1/foo.mjs        |/c-1.mjs      |
|         |                       |              |
|a        |/scope2/foo.mjs        |/a-2.mjs      |
|b        |/scope2/foo.mjs        |/b-1.mjs      |
|c        |/scope2/foo.mjs        |/c-1.mjs      |
|         |                       |              |
|a        |/scope2/scope3/foo.mjs |/a-3.mjs      |
|b        |/scope2/scope3/foo.mjs |/b-3.mjs      |
|c        |/scope2/scope3/foo.mjs |/c-1.mjs      |

### Virtualization examples

As mentioned above, it's important to be able to wrap, extend, or remove access to built-in modules, the same way you can do with globals. The following examples show how to do this.

_Note: All of the following examples can apply to non built-in modules too, but we show the built-in module cases here._

#### Denying access to a built-in module

Although it is drastic and fairly rare, sometimes it is desirable to remove access to certain capabilities from your application. With globals, this can be done via code such as

```js
delete self.WebSocket;
```

With import maps, you can restrict access by mapping a built-in module to the special module `@std/blank`:

```json
{
  "modules": {
    "@std/async-local-storage": "@std/blank"
  }
}
```

This module has no exports, so any attempts to import from it will fail:

```js
import { Storage } from "@std/async-local-storage"; // throws, since @std/blank has no exports
```

_Question: should we introduce a module, e.g. `@std/thrower`, which just throws an exception? The difference would be in cases like `import "@std/async-local-storage"`, where you wouldn't get an exception with `@std/blank` because you're not asking for any imports. This is pretty edge-casey._

#### Selective denial

You can use the scoping feature to restrict access to a built-in module to only some parts of your app:

```json
{
  "modules": {
    "@std/async-local-storage": "@std/blank"
  },
  "scopes": {
    "/js/storage-code/": {
      "@std/async-local-storage": "@std/async-local-storage"
    }
  }
}
```

Alternately, you can use similar techniques to prevent only certain parts of your app from accessing a built-in module:

```json
{
  "scopes": {
    "/node_modules/untrusted-third-party/": {
      "@std/async-local-storage": "@std/blank"
    }
  }
}
```

#### Wrapping a built-in module

It may be desirable to wrap a built-in module, e.g. to instrument it, and then ensure that the rest of your application gets access only to the wrapped version. You would do this by redirecting the rest of your app to the wrapped version:

```json
{
  "modules": {
    "@std/async-local-storage": "/js/als-wrapper.mjs"
  },
  "scopes": {
    "/js/als-wrapper.mjs": {
      "@std/async-local-storage": "@std/async-local-storage"
    }
  }
}
```

This first ensures that in general, `import:@std/async-local-storage` resolves to `/js/als-wrapper.mjs`, but that for the particular scope of the `/js/als-wrapper.mjs` file itself, the resolution behaves as normal. This allows us to write the wrapper file like so:

```js
import instrument from "/js/utils/instrumenter.mjs";
import { storage as orginalStorage, StorageArea as OriginalStorageArea } from "@std/async-local-storage";

export const storage = instrument(originalStorage);
export const StorageArea = instrument(OriginalStorageArea);
```

Now, whenever any part of our app (except the wrapper module itself) imports `@std/async-local-storage`, it will resolve to the wrapper module, giving the wrapped and instrumented exports.

#### Extending a built-in module

The story for extending a built-in module is very similar as for wrapping. For example, let's say that async local storage gained a new export, `SuperAwesomeStorageArea`. We would use the same import map as in the previous example, and just change our wrapper like so:

```js
export { storage, StorageArea } from "@std/async-local-storage";
export class SuperAwesomeStorageArea { ... };
```

(Note: if we just wanted to add a new method to `StorageArea`, there's no need for a wrapper module or a import map. We would just include a polyfill module that imported `StorageArea` and patched a new method onto `StorageArea.prototype`.)

This same principle would apply for removing exports, if for some reason that was desirable.

## Import map processing

### Installation

_The below represents a tentative idea. See the issue tracker for more discussion and alternatives: [#1](https://github.com/domenic/package-name-maps/issues/1)._

You can install an import map for your application using a `<script>` element, either inline (for best performance) or with a `src=""` attribute (in which case you'd better be using HTTP/2 push to get that thing to us as soon as possible):

```html
<script type="importmap">
{
  "modules": { ... },
  "scopes": { ... }
}
</script>
```

```html
<script type="importmap" src="import-map.json"></script>
```

Because they affect all imports, any import maps must be present and successfully fetched before any module resolution is done. This means that module graph fetching, or any fetching of `import:` URLs, is blocked on import map fetching.

Similarly, attempting to add a new `<script type="importmap">` after any module graph fetching, or fetching of `import:` URLs, has started, is an error. The import map will be ignored, and the `<script>` element will fire an error.

Multiple `<script type="importmap">`s are allowed on the page. (See previous discussion in [#14](https://github.com/domenic/package-name-maps/issues/14).) They are merged by an intentionally-simple procedure, roughly equivalent to the JavaScript code

```js
const result = {
  modules: { ...a.modules, ...b.modules },
  scopes: { ...a.scopes, ...b.scopes }
};
```

See [the proto-spec](./spec.md) for more details on how this all works.

_What do we do in workers? Probably `new Worker(someURL, { type: "module", importMap: ... })`? Or should you set it from inside the worker? Should dedicated workers use their controlling document's map, either by default or always? Discuss in [#2](https://github.com/domenic/package-name-maps/issues/2)._

### Scope

Import maps are an application-level thing, somewhat like service workers. (More formally, they would be per-module map, and thus per-realm.) They are not meant to be composed, but instead produced by a human or tool with a holistic view of your web application. For example, it would not make sense for a library to include a import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to.

This, in addition to general simplicity, is in part what motivates the above restrictions on `<script type="importmap">`.

Since an application's import map changes the resolution algorithm for every module in the module map, they are not impacted by whether a module's source text was originally from a cross-origin URL. If you load a module from a CDN that uses bare import specifiers, you'll need to know ahead of time what bare import specifiers that module adds to your app, and include them in your application's import map. (That is, you need to know what all of your application's transitive dependencies are.) It's important that control of which URLs are use for each package stay in control of the application author, so they can holistically manage versioning and sharing of modules.

## Alternatives considered

### The Node.js module resolution algorithm

Unlike in Node.js, in the browser we don't have the luxury of a reasonably-fast file system that we can crawl looking for modules. Thus, we cannot implement the [Node module resolution algorithm](https://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders) directly; it would require performing multiple server round-trips for every `import` statement, wasting bandwidth and time as we continue to get 404s. We need to ensure that every `import` statement causes only one HTTP request; this necessitates some measure of precomputation.

### A programmable resolution hook

Some have suggested customizing the browser's module resolution algorithm using a JavaScript hook to interpret each module specifier.

Unfortunately, this is fatal to performance; jumping into and back out of JavaScript for every edge of a module graph drastically slows down application startup. (Typical web applications have on the order of thousands of modules, with 3-4× that many import statements.) You can imagine various mitigations, such as restricting the calls to only bare import specifiers or requiring that the hook take batches of specifiers and return batches of URLs, but in the end nothing beats precomputation.

Another issue with this is that it's hard to imagine a useful mapping algorithm a web developer could write, even if they were given this hook. Node.js has one, but it is based on repeatedly crawling the filesystem and checking if files exist; we as discussed above, that's infeasible on the web. The only situation in which a general algorithm would be feasible is if (a) you never needed per-subgraph customization, i.e. only one version of every module existed in your application; (b) tooling managed to arrange your modules ahead of time in some uniform, predictable fashion, so that e.g. the algorithm becomes "return `/js/${specifier}.js`". But if we're in this world anyway, a declarative solution would be simpler.

### Ahead-of-time rewriting

One solution in use today (e.g. in the [unpkg](https://unpkg.com/) CDN via [babel-plugin-unpkg](https://www.npmjs.com/package/babel-plugin-unpkg)) is to rewrite all bare import specifiers to their appropriate absolute URLs ahead of time, using build tooling. This could also be done at install time, so that when you install a package using npm, it automatically rewrites the package's contents to use absolute or relative URLs instead of bare import specifiers.

The problem with this approach is that it does not work with dynamic `import()`, as it's impossible to statically analyze the strings passed to that function. You could inject a fixup that, e.g., changes every instance of `import(x)` into `import(specifierToURL(x, import.meta.url))`, where `specifierToURL` is another function generated by the build tool. But in the end this is a fairly leaky abstraction, and the `specifierToURL` function largely duplicates the work of this proposal anyway.

### Service workers

At first glance, service workers seem like the right place to do this sort of resource translation. We've talked in the past about finding some way to pass the specifier along with a service worker's fetch event, thus allowing it to give back an appropriate `Response`.

However, _service workers are not available on first load_. Thus, they can't really be a part of the critical infrastructure used to load modules. They can only be used as a progressive enhancement on top of fetches that will otherwise generally work.

### A convention-based flat mapping

If you have a simple applications with no need for scoped dependency resolution, and have a package installation tool which is comfortable rewriting paths on disk inside the package (unlike current versions of npm), you could get away with a much simpler mapping. For example, if your installation tool created a flat listing of the form

```
node_modules_flattened/
  lodash/
    index.js
    core.js
    fp.js
  moment/
    index.js
  html-to-dom/
    index.js
```

then the only information you need is

- A base URL (in our app, `/node_modules_flattened/`)
- The main module filename used (in our app, `index.js`)

You could imagine a module import configuration format that only specified these things, or even only some subset (if we baked in assumptions for the others).

This idea does not work for more complex applications which need scoped resolution, so we believe the full import map proposal is necessary. But it remains attractive for simple applications, and we wonder if there's a way to make theproposal also have an easy-mode that does not require listing all modules, but instead relies on conventions and tools to ensure minimal mapping is needed. Discuss in [#7](https://github.com/domenic/package-name-maps/issues/7).

## Adjacent concepts

### Supplying out-of-band metadata for each module

Several times now it's come up that people desire to supply metadata for each module; for example, [integrity metadata](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), or fetching options. Although some have proposed doing this with an import statement, [careful consideration of the options](https://docs.google.com/presentation/d/1qfoLTniLUVJ5YNFrha7BaVumAnW0ZgcCfUU8UbyyuYY/edit#slide=id.p) leads to preferring an out-of-band manifest file.

The import map _could_ be that manifest file. However, it may not be the best fit, for a few reasons:

- As currently envisioned, most modules in an application would not have entires in the import map. The main use case is for modules you need to refer to by bare specifiers, or modules where you need to do something tricky like polyfilling or virtualizing. If we envisioned every module being in the map, we would not include convenience features like packages-via-trailing-slashes.

- All proposed metadata so far is applicable to any sort of resource, not just JavaScript modules. A solution should probably work at a more general level.

### Module-relative URL resolution

Another nice feature of `import:` URLs is that it gives us a solution for [URL resolution relative to the module](https://github.com/whatwg/html/issues/3871). Instead of

```js
const response = await fetch(new URL('../hamsters.jpg', import.meta.url).href);
```

we can just do

```js
const response = await fetch('import:../hamsters.jpg');
```

## Implementation notes

### `import:` URL staging

The most dramatic and scary feature of this proposal is the introduction of a new URL scheme, `import:`. Logistically, this involves cross-cutting implementation work that goes outside of the usual "module loading" pipeline, and starts affecting network code.

We believe `import:` URLs are valuable, and solve a real developer need. They were a [prominent feature request](https://github.com/domenic/package-name-maps/issues/23) against earlier versions of this proposal. We believe that having a proposal that incorporates them is better than trying to tack them on later.

That said, in terms of implementation staging, it's easy to slice this proposal into a "without `import:` URLs" implementation that later gets followed by a "with `import:` URLs" implementation. Simply by making import maps only affect `import` statements and `import()` expressions at first, an implementation can deliver much of the value, and later work on the `import:` URL implementation.

### Further implementation staging

Speaking of delivering incremental value, it's worth noting that by even before getting to `import:` URLs, implementations can ship subsets of the proposal that solve important use cases. For example, one implementation plan could be:

- Only support map entries of the form `"http(s) URL": ["built-in module", "same http(s) URL"]`. ([See above](#for-built-in-modules-in-module-import-map-supporting-browsers) for a realistic example.) This enables built-in module polyfilling in a backward-compatible way.
- Support general URL and non-array right-hand sides of the map entries. This enables basic bare import specifier support.
- Support scoping. This enables full "npm parity" bare import specifier support.
- Support fallbacks from HTTP(S) URLs to HTTP(S) URLs. This allows supplanting the [terrible `document.write()`-using sync-script-loading hacks](https://www.hanselman.com/blog/CDNsFailButYourScriptsDontHaveToFallbackFromCDNToLocalJQuery.aspx).

### `import:` URL loads and origins

Particular questions come up around whether `import:` URLs can be used for navigations or worker loads. In these cases, the origin of such URLs would become important. Some potential answers:

- These URLs cannot be used for navigations or workers
- These URLs can be used for navigations or workers, but have an opaque origin
- These URLs can be used for navigations or workers, and have an origin derived from where they resolve to? (This might not be possible.)

Almost certainly the right path is to start by disallowing such uses of `import:` URLs

### `import:` URL interaction with other loading infrastructure

Several implementer questions come up around how `import:` URLs are envisioned to interact with other loading infrastructure, for example service workers. Initial attempts to answer these sorts of questions are in [the proto-spec](./spec.md).

The high-level summary is that any fetch of an `import:` URL should be thought of as sugar for a series of if-then-else statements that in turn fetch the mapped-to URLs. For example, each fetch will pass through the service worker, until one succeeds.

## Acknowledgments

This document originated out of a day-long sprint involving [@domenic](https://github.com/domenic), [@hiroshige-g](https://github.com/hiroshige-g), [@justinfagnani](https://github.com/justinfagnani), [@MylesBorins](https://github.com/MylesBorins), and [@nyaxt](https://github.com/nyaxt). Since then, [@guybedford](https://github.com/guybedford) has been instrumental in prototyping and driving forward discussion on this proposal.

Thanks also to all of the contributors on the issue tracker for their help in evolving the proposal!

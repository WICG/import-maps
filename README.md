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
  - [Specifier remapping examples](#specifier-remapping-examples)
    - [Bare specifiers for JavaScript modules](#bare-specifiers-for-javascript-modules)
    - ["Packages" via trailing slashes](#packages-via-trailing-slashes)
    - [General URL-like specifier remapping](#general-url-like-specifier-remapping)
    - [Extension-less imports](#extension-less-imports)
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
- [`import:` URLs](#import-urls)
  - [A widget package example](#a-widget-package-example)
  - [A data file package example](#a-data-file-package-example)
  - [URL resolution semantics](#url-resolution-semantics)
- [Import map processing](#import-map-processing)
  - [Installation](#installation)
  - [Dynamic import map example](#dynamic-import-map-example)
  - [Scope](#scope)
- [Alternatives considered](#alternatives-considered)
  - [The Node.js module resolution algorithm](#the-nodejs-module-resolution-algorithm)
  - [A programmable resolution hook](#a-programmable-resolution-hook)
  - [Ahead-of-time rewriting](#ahead-of-time-rewriting)
  - [Service workers](#service-workers)
  - [A convention-based flat mapping](#a-convention-based-flat-mapping)
- [Adjacent concepts](#adjacent-concepts)
  - [Supplying out-of-band metadata for each module](#supplying-out-of-band-metadata-for-each-module)
  - [Alternating logic based on the presence of a built-in module](#alternating-logic-based-on-the-presence-of-a-built-in-module)
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

- Sharing the notion of "import specifiers" between JavaScript importing contexts and traditional URL contexts, such as `fetch()`, `<img src="">` or `<link href="">`

The mechanism for doing this is via an _import map_ which can be used to control the resolution of module specifiers generally, as well as an `import:` URL scheme to allow access to the same resolution logic in URL-accepting contexts such as HTML and CSS. As an introductory example, consider the code

```js
import moment from "moment";
import { partition } from "lodash";
```

Today, this throws, as such bare specifiers [are explicitly reserved](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier). By supplying the browser with the following import map

```json
{
  "imports": {
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

We explain the features of the import map via a series of examples.

### Specifier remapping examples

#### Bare specifiers for JavaScript modules

As mentioned in the introduction,

```json
{
  "imports": {
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

Note that the right-hand side of the mapping (known as the "address") must start with `/`, `../`, or `./`, or be parseable as an absolute URL, to identify a URL. (Other cases are explained [later](#for-built-in-modules-in-module-import-map-supporting-browsers).)

#### "Packages" via trailing slashes

It's common in the JavaScript ecosystem to have a package (in the sense of [npm](https://www.npmjs.com/)) contain multiple modules, or other files. For such cases, we want to map a prefix in the module specifier space, onto another prefix in the fetchable-URL space.

Import maps do this by giving special meaning to specifier keys that end with a trailing slash. Thus, a map like

```json
{
  "imports": {
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

#### General URL-like specifier remapping

As part of allowing general remapping of specifiers, import maps specifically allow remapping of URL-like specifiers, such as `"https://example.com/foo.mjs"` or `"./bar.mjs"`. One of the more advanced usages of this is [for fallbacks](#for-built-in-modules-in-browsers-without-import-maps), but here we demonstrate some basic ones to communicate the concept:

```json
{
  "imports": {
    "https://www.unpkg.com/vue/dist/vue.runtime.esm.js": "/node_modules/vue/dist/vue.runtime.esm.js"
  }
}
```

This remapping ensures that any imports of the unpkg.com version of Vue (at least at that URL) instead grab the one from the local server.

```json
{
  "imports": {
    "/app/helpers.mjs": "/app/helpers/index.mjs"
  }
}
```

This remapping ensures that any URL-like imports that resolve to `/app/helpers.mjs`, including e.g. an `import "./helpers.mjs"` from files inside `/app/`, or an `import "../helpers.mjs"` from files inside `/app/models`, will instead resolve to `/app/helpers/index.mjs`. This is probably not a good idea; instead of creating an indirection which obfuscates your code, you should instead just update your source files to import the correct files. But, it is a useful example for demonstrating the capabilities of import maps.

Such remapping can also be done on a prefix-matched basis, by ending the specifier key with a trailing slash:

```json
{
  "imports": {
    "https://www.unpkg.com/vue/": "/node_modules/vue/"
  }
}
```

This version ensures that import statements for specifiers that start with the substring `"https://www.unpkg.com/vue/"` will be mapped to the corresponding URL underneath `/node_modules/vue/`.

In general, the point is that the remapping works the same for URL-like imports as for bare imports. Our previous examples changed the resolution of specifiers like `"lodash"`, and thus changed the meaning of `import "lodash"`. Here we're changing the resolution of specifiers like `"/app/helpers.mjs"`, and thus changing the meaning of `import "/app/helpers.mjs"`.

#### Extension-less imports

It is also common in the Node.js ecosystem to import files without including the extension. [We do not have the luxury](#the-nodejs-module-resolution-algorithm) of trying multiple file extensions until we find a good match. However, we can emulate something similar by using an import map. For example,

```json
 {
   "imports": {
     "lodash": "/node_modules/lodash-es/lodash.js",
     "lodash/": "/node_modules/lodash-es/",
     "lodash/fp": "/node_modules/lodash-es/fp.js",
   }
 }
```

would allow not only `import fp from "lodash/fp.js"`, but also allow `import fp from "loadsh/fp"`.

Although this example shows how it is _possible_ to allow extension-less imports with import maps, it's not necessarily _desirable_. Doing so bloats the import map, and makes the package's interface less simple—both for humans and for tooling.

This bloat is especially problematic if you need to allow extension-less imports within a package. In that case you will need an import map entry for every file in the package, not just the top-level entry points. For example, to allow `import "./fp"` from within the `/node_modules/lodash-es/lodash.js` file, you would need an import entry mapping `/node_modules/lodash-es/fp` to `/node_modules/lodash-es/fp.js`. Now imagine repeating this for every file referenced without an extension.

As such, we recommend caution when employing patterns like this in your import maps, or writing modules. It will be simpler for the ecosystem if we don't rely on import maps to patch up file-extension related mismatches.

### Fallback examples

#### For user-supplied packages

Consider the case of wanting to use a CDN's copy of a library, but fall back to a local copy if the CDN is unavailable. Today this is often accomplished via [terrible `document.write()`-using sync-script-loading hacks](https://www.hanselman.com/blog/CDNsFailButYourScriptsDontHaveToFallbackFromCDNToLocalJQuery.aspx). With import maps providing a first-class way of controlling module resolution, we can do better.

To provide fallbacks, use an address array, instead of a string address, for the right-hand side of your mapping:

```json
{
  "imports": {
    "jquery": [
      "https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js",
      "/node_modules/jquery/dist/jquery.js"
    ]
  }
}
```

In this case, any attempts to import with the specifier `"jquery"` will first try to fetch the CDN URL, but if that fails, fall back to the copy in `/node_modules/`. (This fallback process will happen only once, and the choice will be cached for all future imports.)

_Side note: you can think of the string address form as just sugar for a single-element array address. That is, `"jquery": "/node_modules/jquery/dist/jquery.js"` is sugar for `"jquery": ["/node_modules/jquery/dist/jquery.js"]`._

#### For built-in modules, in module-import-map-supporting browsers

When a browser supports import maps, we can use the same principle as the above example to support fallbacks for built-in modules.

For example, consider the following import map, which supplies a polyfill fallback for [KV storage](https://wicg.github.io/kv-storage/):

```json
{
  "imports": {
    "std:kv-storage": [
      "std:kv-storage",
      "/node_modules/kvs-polyfill/index.mjs"
    ]
  }
}
```

Now, statements like

```js
import { StorageArea } from "std:kv-storage";
```

will first try to resolve to the `std:kv-storage` URL, i.e. to the browser's built-in implementation of KV storage. If that fails, e.g. because the browser does not implement KV storage, then instead it will fetch the polyfill, at `/node_modules/kvs-polyfill/index.mjs`.

_Note: the usage of the `std:` prefix for built-in module examples is for illustrative purposes. This proposal is generic, and would be able to work with any built-in module prefix._

#### For built-in modules, in browsers without import maps

The goal of the previous example is to use a polyfill in older browsers, but the built-in module in newer browsers. But it falls down in the case of browsers that are old enough to not support import maps at all. (That is, all of today's currently-shipping browsers.) In such cases, the statement `import { StorageArea } from "std:kv-storage"` will always fail, with no chance to remap it.

How can we write code that uses a polyfill in today's browsers, but uses built-in modules in future browsers that support them? We do this by changing our import statement to import the _polyfill_'s URL:

```js
import { StorageArea } from "/node_modules/kvs-polyfill/index.mjs";
```

and then remapping the polyfill to the built-in module for module-import-map-supporting browsers:

```json
{
  "imports": {
    "/node_modules/kvs-polyfill/index.mjs": [
      "std:kv-storage",
      "/node_modules/kvs-polyfill/index.mjs"
    ]
  }
}
```

With this mapping, each class of browser behaves as desired, for our above import statement:

- Browsers that do not support import maps will receive the polyfill.
- Browsers that support import maps, but do not support KV storage, will end up with a mapping from the polyfill URL to itself, and so will receive the polyfill anyway.
- Browsers that support both import maps and KV storage will end up with a mapping from the polyfill URL to `std:kv-storage`, and so will receive the built-in module.

Note how we're using a capability here that we briefly explored in [a previous example](#general-url-like-specifier-remapping): remapping imports of "URL-like" specifiers, not just bare specifiers.

(Note that, in general, there is only one level of resolution. The address is not itself treated as a specifier and recursively remapped.)

##### This doesn't work for `<script>`

An important caveat to the above example is that it does _not_ help for `<script src="">` scenarios. That is, while

```js
import "/node_modules/virtual-scroller-polyfill/index.mjs";
```

would have the correct behavior (using the built-in version when appropriate) in all classes of browser,

```html
<script type="module" src="/node_modules/virtual-scroller-polyfill/index.mjs"></script>
```

would not: in all classes of browsers, it would fetch the polyfill unconditionally. What _would_ work, in import-map-supporting browsers, would be

```html
<script type="module" src="import:/node_modules/virtual-scroller-polyfill/index.mjs"></script>
```

(See below for more on the subtleties of `import:` URLs.) But alas, in browsers without support for import maps, this will result in a network error. Thus, for side-effecting modules, you'd instead want to use the pattern

```html
<script type="module">import "/node_modules/virtual-scroller-polyfill/index.mjs";</script>
```

which will work as desired in all classes of browser.

### Scoping examples

#### Multiple versions of the same module

It is often the case that you want to use the same import specifier to refer to multiple versions of a single library, depending on who is importing them. This encapsulates the versions of each dependency in use, and avoids [dependency hell](http://npm.github.io/how-npm-works-docs/theory-and-design/dependency-hell.html) ([longer blog post](http://blog.timoxley.com/post/20772365842/node-js-npm-reducing-dependency-overheads)).

We support this use case in import maps by allowing you to change the meaning of a specifier within a given _scope_:

```json
{
  "imports": {
    "querystringify": "/node_modules/querystringify/index.js"
  },
  "scopes": {
    "/node_modules/socksjs-client/": {
      "querystringify": "/node_modules/socksjs-client/querystringify/index.js"
    }
  }
}
```

(This is example is one of several [in-the-wild examples](https://github.com/WICG/import-maps/issues/5#issuecomment-374175653) of multiple versions per application provided by @zkat. Thanks, @zkat!)

With this mapping, inside any modules whose URLs start with `/node_modules/socksjs-client/`, the `"querystringify"` specifier will refer to `/node_modules/socksjs-client/querystringify/index.js`. Whereas otherwise, the top-level mapping will ensure that `"querystringify"` refers to `/node_modules/querystringify/index.js`.

#### Scope inheritance

Scopes "inherit" from each other in an intentionally-simple manner, merging but overriding as they go. For example, the following import map:

```json
{
  "imports": {
    "a": "/a-1.mjs",
    "b": "/b-1.mjs",
    "c": "/c-1.mjs"
  },
  "scopes": {
    "/scope2/": {
      "a": "/a-2.mjs"
    },
    "/scope2/scope3/": {
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
|a        |/scope2/scope3/foo.mjs |/a-2.mjs      |
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

With import maps, you can restrict access by mapping a built-in module to the empty address array, i.e. saying "there are no URLs or built-in modules that this should map to":

```json
{
  "imports": {
    "std:kv-storage": []
  }
}
```

Alternately, you can use the form

```json
{
  "imports": {
    "std:kv-storage": null
  }
}
```

which means the same thing.

With this in place, any attempts to resolve the `"std:kv-storage"` specifier will fail. For example,

```js
import { Storage } from "std:kv-storage"; // throws
```

#### Selective denial

You can use the scoping feature to restrict access to a built-in module to only some parts of your app:

```json
{
  "imports": {
    "std:kv-storage": null
  },
  "scopes": {
    "/js/storage-code/": {
      "std:kv-storage": "std:kv-storage"
    }
  }
}
```

(The way in which this map operates within the scope, "mapping `std:kv-storage` to itself", may appear a bit confusing. The key is to remember that the left hand side is a module specifier, and the right hand side is a URL. So you can read this as saying that, whenever the `"std:kv-storage"` specifier gets imported within that scope, it resolves to the `std:kv-storage` URL.)

Alternately, you can use similar techniques to prevent only certain parts of your app from accessing a built-in module:

```json
{
  "scopes": {
    "/node_modules/untrusted-third-party/": {
      "std:kv-storage": null
    }
  }
}
```

#### Wrapping a built-in module

It may be desirable to wrap a built-in module, e.g. to instrument it, and then ensure that the rest of your application gets access only to the wrapped version. You would do this by redirecting the rest of your app to the wrapped version:

```json
{
  "imports": {
    "std:kv-storage": "/js/als-wrapper.mjs"
  },
  "scopes": {
    "/js/als-wrapper.mjs": {
      "std:kv-storage": "std:kv-storage"
    }
  }
}
```

This first ensures that in general, `"std:kv-storage"` resolves to `/js/als-wrapper.mjs`, but that for the particular scope of the `/js/als-wrapper.mjs` file itself, the resolution behaves as normal. This allows us to write the wrapper file like so:

```js
import instrument from "/js/utils/instrumenter.mjs";
import { storage as orginalStorage, StorageArea as OriginalStorageArea } from "std:kv-storage";

export const storage = instrument(originalStorage);
export const StorageArea = instrument(OriginalStorageArea);
```

Now, whenever any part of our app (except the wrapper module itself) imports `"std:kv-storage"`, it will resolve to the wrapper module, giving the wrapped and instrumented exports.

#### Extending a built-in module

The story for extending a built-in module is very similar as for wrapping. For example, let's say that KV storage gained a new export, `SuperAwesomeStorageArea`. We would use the same import map as in the previous example, and just change our wrapper like so:

```js
export { storage, StorageArea } from "std:kv-storage";
export class SuperAwesomeStorageArea { ... };
```

(Note: if we just wanted to add a new method to `StorageArea`, there's no need for a wrapper module or an import map. We would just include a polyfill module that imported `StorageArea` and patched a new method onto `StorageArea.prototype`.)

This same principle would apply for removing exports, if for some reason that was desirable.

## `import:` URLs

As a supplement to the base import map concept, we introduce the new `import:` URL scheme. This scheme allows easier access to "packaged" resources from within HTML, CSS, or other URL-accepting parts of the platform such as `fetch()`.

### A widget package example

Consider a UI widget, distributed under the "package name" `widget`. It contains not only a JavaScript module, but also CSS themes, and corresponding images. You could configure a import map like

```json
{
  "imports": {
    "widget": "/node_modules/widget/index.mjs",
    "widget/": "/node_modules/widget/"
  }
}
```

and then do

```html
<link rel="stylesheet" href="import:widget/themes/light.css">
<script type="module" src="import:widget"></script>
```

or

```css
.back-button {
  background: url('import:widget/assets/back.svg');
}
```

This brings the name-coordination benefits of JavaScript's bare import specifiers (i.e., npm-style packages) to all web resources.

### A data file package example

Consider a package of JSON data, for example [the timezone database](https://www.npmjs.com/package/tzdata). Similar to the above, you could configure

```json
{
  "imports": {
    "tzdata": "/node_modules/tzdata/timezone-data.json"
  }
}
```

and then write JavaScript code that did

```js
const data = await (await fetch('import:tzdata')).json();
```

### URL resolution semantics

Exactly how `import:` URLs are resolved is still somewhat vague: in particular, what "referrer URL" is used for the purposes of:

- Resolving relative specifiers, such as in `import:./foo`
- Deciding which scope to use when consulting the realm's import map.

The first of these is not a big deal, as the corresponding use cases are not terribly important anyway. But the second is important. Consider a case where most of your app can use v2 of `widget`, but one of your third-party dependencies (call it `gadget`) needs to get v1, because it depends on the previous API contract. You would generally handle this via an import map like so:

```json
{
  "imports": {
    "widget": "/node_modules/widget-v2/index.mjs",
    "widget/": "/node_modules/widget-v2/"
  },
  "scopes": {
    "/node_modules/gadget/": {
      "widget": "/node_modules/widget-v1/index.mjs",
      "widget/": "/node_modules/widget-v1/"
    }
  }
}
```

The question is then, inside `/node_modules/gadget/styles.css`, how does

```css
.back-button {
  background: url(import:widget/back-button.svg);
}
```

resolve? The desired answer is to resolve to the corresponding v1 URL, i.e. `/node_modules/widget-v1/back-button.svg`.

Our current tentative proposal is that the referrer URL for `import:` fetches be determined by using the request's referrer URL. In practice, this will mean:

- By default, use "the page's base URL" (in spec terms: the fetch client's API base URL)
- If the fetch is from a CSS file, use the CSS file's URL (in spec terms: its [location](https://drafts.csswg.org/cssom/#concept-css-style-sheet-location); see [Referrer Policy](https://w3c.github.io/webappsec-referrer-policy/#integration-with-css))
- If the fetch is from a [HTML module](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/html-module-spec-changes.md), use the module's base URL (not yet specified)

Note how the default choice here makes things still a bit fragile, when used from JavaScript source files. Consider code inside `/node_modules/gadget/index.mjs`:

```js
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'import:widget/themes/light.css';
document.head.append(link);
```

This code will not behave as desired; the URL of the stylesheet that is fetched will be `/node_modules/widget-v2/themes/light.css`, instead of the counterpart v1 URL.

The proposed solution is that we should instead provide an `import.meta.resolve()` function, which (like `import()` or `import` statements) works relative to the active script URL. Then you could write

```js
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = import.meta.resolve('widget/themes/light.css');
document.head.append(link);
```

However, this gets a little complicated due to the [fallbacks for user-supplied packages](#for-user-supplied-packages) feature; see discussion in [#79](https://github.com/WICG/import-maps/issues/79).

_Previous versions of this proposal anticipated making `import:` URLs resolve relative to the current active script. However, that has intractable problems, as discussed in [#75](https://github.com/WICG/import-maps/issues/75)._


## Import map processing

### Installation

You can install an import map for your application using a `<script>` element, either inline (for best performance) or with a `src=""` attribute (in which case you'd better be using HTTP/2 push to get that thing to us as soon as possible):

```html
<script type="importmap">
{
  "imports": { ... },
  "scopes": { ... }
}
</script>
```

```html
<script type="importmap" src="import-map.importmap"></script>
```

When the `src=""` attribute is used, the resulting HTTP response must have the MIME type `application/importmap+json`. (Why not reuse `application/json`? Doing so could [enable CSP bypasses](https://github.com/WICG/import-maps/issues/105).) Like module scripts, the request is made with CORS enabled, and the response is always interpreted as UTF-8.

Because they affect all imports, any import maps must be present and successfully fetched before any module resolution is done. This means that module graph fetching, or any fetching of `import:` URLs, is blocked on import map fetching.

Similarly, attempting to add a new `<script type="importmap">` after any module graph fetching, or fetching of `import:` URLs, has started, is an error. The import map will be ignored, and the `<script>` element will fire an `error` event.

Multiple `<script type="importmap">`s are allowed on the page. (See previous discussion in [#14](https://github.com/WICG/import-maps/issues/14).) They are merged by an intentionally-simple procedure, roughly equivalent to the JavaScript code

```js
const result = {
  imports: { ...a.imports, ...b.imports },
  scopes: { ...a.scopes, ...b.scopes }
};
```

See [the proto-spec](./spec.md) for more details on how this all works.

_What do we do in workers? Probably `new Worker(someURL, { type: "module", importMap: ... })`? Or should you set it from inside the worker? Should dedicated workers use their controlling document's map, either by default or always? Discuss in [#2](https://github.com/WICG/import-maps/issues/2)._

### Dynamic import map example

The above rules mean that you _can_ dynamically generate import maps, as long as you do so before performing any imports. For example:

```html
<script>
const im = document.createElement('script');
im.type = 'importmap';
im.textContent = JSON.stringify({
  imports: {
    'my-library': Math.random() > 0.5 ? '/my-awesome-library.mjs' : '/my-rad-library.mjs';
  }
});
document.currentScript.after(im);
</script>

<script type="module">
import 'my-library'; // will fetch the randomly-chosen URL
</script>
```

A more realistic example might use this capability to override a previous import map based on feature detection:

```html
<script type="importmap">
{
  "imports": {
    "lodash": "/lodash.mjs",
    "moment": "/moment.mjs"
  }
}
</script>

<script>
if (!someFeatureDetection()) {
  const im = document.createElement('script');
  im.type = 'importmap';
  im.textContent = '{ "imports": { "lodash": "/lodash-legacy-browsers.js" } }';
  document.currentScript.after(im);
}
</script>

<script type="module">
import _ from "lodash"; // will fetch the right URL for this browser
</script>
```

Note that (like other `<script>` elements) modifying the contents of a `<script type="importmap">` after it's already inserted in the document will not work; this is why we wrote the above example by inserting a second `<script type="importmap">` to overwrite the first one.

### Scope

Import maps are an application-level thing, somewhat like service workers. (More formally, they would be per-module map, and thus per-realm.) They are not meant to be composed, but instead produced by a human or tool with a holistic view of your web application. For example, it would not make sense for a library to include an import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to.

This, in addition to general simplicity, is in part what motivates the above restrictions on `<script type="importmap">`.

Since an application's import map changes the resolution algorithm for every module in the module map, they are not impacted by whether a module's source text was originally from a cross-origin URL. If you load a module from a CDN that uses bare import specifiers, you'll need to know ahead of time what bare import specifiers that module adds to your app, and include them in your application's import map. (That is, you need to know what all of your application's transitive dependencies are.) It's important that control of which URLs are used for each package stay with the application author, so they can holistically manage versioning and sharing of modules.

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

This idea does not work for more complex applications which need scoped resolution, so we believe the full import map proposal is necessary. But it remains attractive for simple applications, and we wonder if there's a way to make the proposal also have an easy-mode that does not require listing all modules, but instead relies on conventions and tools to ensure minimal mapping is needed. Discuss in [#7](https://github.com/WICG/import-maps/issues/7).

## Adjacent concepts

### Supplying out-of-band metadata for each module

Several times now it's come up that people desire to supply metadata for each module; for example, [integrity metadata](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), or fetching options. Although some have proposed doing this with an import statement, [careful consideration of the options](https://docs.google.com/presentation/d/1qfoLTniLUVJ5YNFrha7BaVumAnW0ZgcCfUU8UbyyuYY/edit#slide=id.p) leads to preferring an out-of-band manifest file.

The import map _could_ be that manifest file. However, it may not be the best fit, for a few reasons:

- As currently envisioned, most modules in an application would not have entries in the import map. The main use case is for modules you need to refer to by bare specifiers, or modules where you need to do something tricky like polyfilling or virtualizing. If we envisioned every module being in the map, we would not include convenience features like packages-via-trailing-slashes.

- All proposed metadata so far is applicable to any sort of resource, not just JavaScript modules. A solution should probably work at a more general level.

### Alternating logic based on the presence of a built-in module

_See further discussion of this case in the issue tracker: [#61](https://github.com/WICG/import-maps/issues/61)._

Not all fallbacks take the role of running one piece of code. For example, sometimes, one code path is to be taken if a particular platform API exists, and another code path is taken if it doesn't exist. The import maps proposal does not aim to solve all such scenarios in a built-in way; instead, the stage 2 TC39 proposal [top-level await](https://github.com/tc39/proposal-top-level-await) can be used to meet some of these use cases.

Imagine if IndexedDB were provided by a built-in module `std:indexed-db` and localStorage were provided by a built-in module `std:local-storage`. For a particular application, all supported browsers support localStorage, and only some support IndexedDB. Although it's possible to polyfill IndexedDB on top of localStorage, in this scenario, doing so leads to performance overhead vs more specialized usage. Therefore, it's preferrable to use a specialized implementation based on either IndexedDB or localStorage directly, instead of using import maps to remap `std:indexed-db`.

In this scenario, a module may use top-level await to perform feature testing and fallback as follows:

```js
export let myStorageFunction;

try {
  const indexedDB = await import("std:indexed-db");
  myStorageFunction = function() { /* in terms of indexedDB */ };
} catch (e) {
  const localStorage = await import("std:local-storage");
  myStorageFunction = function() { /* in terms of localStorage */ };
}
```

## Implementation notes

### `import:` URL staging

The `import:` URL feature is ambitious in that it involves cross-cutting implementation work that goes outside of the usual "module loading" pipeline, and starts affecting network code.

We believe `import:` URLs are valuable, and solve a real developer need. They were a [prominent feature request](https://github.com/WICG/import-maps/issues/23) against earlier versions of this proposal. We believe that having a proposal that incorporates them is better than trying to tack them on later.

That said, in terms of implementation staging, it's easy to slice this proposal into a "without `import:` URLs" implementation that later gets followed by a "with `import:` URLs" implementation. Simply by making import maps only affect `import` statements and `import()` expressions at first, an implementation can deliver much of the value, and later work on the `import:` URL implementation.

### Further implementation staging

Speaking of delivering incremental value, it's worth noting that by even before getting to `import:` URLs, implementations can ship subsets of the proposal that solve important use cases. For example, one implementation plan could be:

- Only support map entries of the form `"http(s) URL": ["built-in module", "same http(s) URL"]`. ([See above](#for-built-in-modules-in-module-import-map-supporting-browsers) for a realistic example.) This enables built-in module polyfilling in a backward-compatible way.
- Support general URL and non-array addresses in the specifier map. This enables basic bare import specifier support.
- Support scoping. This enables full "npm parity" bare import specifier support.
- Support fallbacks from HTTP(S) URLs to HTTP(S) URLs. This allows supplanting the [terrible `document.write()`-using sync-script-loading hacks](https://www.hanselman.com/blog/CDNsFailButYourScriptsDontHaveToFallbackFromCDNToLocalJQuery.aspx).

### `import:` URL loads and origins

Particular questions come up around whether `import:` URLs can be used for navigations or worker loads. In these cases, the origin of such URLs would become important. Some potential answers:

- These URLs cannot be used for navigations or workers
- These URLs can be used for navigations or workers, but have an opaque origin
- These URLs can be used for navigations or workers, and have an origin derived from where they resolve to.

We can easily start by disallowing such uses of `import:` URLs, and expanding to one of the other two options later.

### `import:` URL interaction with other loading infrastructure

Several implementer questions come up around how `import:` URLs are envisioned to interact with other loading infrastructure, for example service workers. Initial attempts to answer these sorts of questions are in [the proto-spec](./spec.md).

The high-level summary is that any fetch of an `import:` URL should be thought of as sugar for a series of if-then-else statements that in turn fetch the mapped-to URLs. For example, each fetch will pass through the service worker, until one succeeds.

## Acknowledgments

This document originated out of a day-long sprint involving [@domenic](https://github.com/domenic), [@hiroshige-g](https://github.com/hiroshige-g), [@justinfagnani](https://github.com/justinfagnani), [@MylesBorins](https://github.com/MylesBorins), and [@nyaxt](https://github.com/nyaxt). Since then, [@guybedford](https://github.com/guybedford) has been instrumental in prototyping and driving forward discussion on this proposal.

Thanks also to all of the contributors on the issue tracker for their help in evolving the proposal!

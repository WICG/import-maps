# Module import maps

_Or, how to control the behavior of JavaScript imports_

## The basic idea

This proposal allows control over what URLs get fetched by JavaScript `import` statements and `import()` expressions, and allows this mapping to be reused in non-import contexts. This solves a variety of important use cases, such as:

- Allowing "bare import specifiers", such as `import moment from "moment"`, to work

- Providing fallback resolution, so that `import $ from "jquery"` can try to go to a CDN first, but fall back to a local version if the CDN server is down

- Enabling polyfilling of, or other control over, built-in modules (including [layered APIs](https://github.com/drufball/layered-apis))

- Sharing the notion of a "package" between JavaScript importing contexts and traditional URL contexts, such as `fetch()`, `<img src="">` or `<link href="">`

The mechanism for doing this is via a new `import:` URL scheme, plus a _module resolver map_ which can be used to control the resolution of `import:` URLs. As an introductory example, consider the code

```js
import moment from "moment";
import { partition } from "lodash";
```

Today, this throws, as such bare specifiers [are explicitly reserved](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier). By supplying the browser with the following module resolver map

```json
{
  "moment": "/node_modules/src/moment.js",
  "lodash": "/node_modules/src/lodash-es/lodash.js"
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

When considering the introduction of built-in modules to the web, e.g. [via TC39](https://github.com/tc39/proposal-javascript-standard-library) or [via web standards](https://github.com/drufball/layered-apis), we need to ensure that we do not lose any of the important features we have today when introducing features via new globals. Notably, these include:

- Polyfilling: the ability to supply a polyfill module that acts as the built-in one
- Virtualization: the ability to wrap, extend, or remove access to the built-in module

Both of these capabilities are easy to achieve with globals, but without some mechanism for modifying module resolution, they are not possible for modules (including built-in modules). The module import maps proposal provides that mechanism.

Note that these use cases are complicated by the need to support browsers without module import map support. More on that below.

## The proposal

### `import:` URLs and the module resolver map

`import:` is a new URL scheme which is reserved for purposes related to JavaScript module resolution. As non-[special](https://url.spec.whatwg.org/#special-scheme) URLs, `import:` URLs just consist of two parts: the leading `import:`, and the following [path](https://url.spec.whatwg.org/#concept-url-path) component. (This is the same as `blob:` or `data:` URLs.)

The behavior of `import:` URLs is controlled by the _module resolver map_, which is a JSON structure that gives a declarative way of modifying the resolution of `import:` URLs, per the above algorithm. (If you are surprised by the use of a declarative solution, you may want to briefly visit the ["Alternatives considered"](#alternatives-considered) section to read up on why we think this is the best path.)

In addition to being usable in all the places a URL normally is available, such as `fetch()`, `<link>`, `<img>`, etc., `import:` URLs are also made to underpin specifier resolution into JavaScript modules. That is, any import statements such as

```js
import "./x";
import "../y";
import "/z";
import "w";     // bare specifier!
```

will resolve the URLs `import:./x`, `import:../y`, `import:/z`, and `import:w`, using the module import map where applicable. This means module import maps have complete control over specifier resolution—both "bare" and "URL-like".

We explain the features of the module resolver map via a series of examples.

### Bare specifier examples

#### Bare specifiers for JavaScript modules

As mentioned in the introduction,

```json
{
  "moment": "/node_modules/src/moment.js",
  "lodash": "/node_modules/src/lodash-es/lodash.js"
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

#### Bare specifiers for other resources

Because `import:` URLs can be used anywhere, they aren't only applicable to JavaScript imports. For example, consider a widget package that contains not only a JavaScript module, but also CSS themes, and corresponding images. You could configure a module resolver map like

```json
{
  "widget": "/node_modules/widget/index.mjs",
  "widget-light": "/node_modules/widget/themes/light.css",
  "widget-back-button": "/node_modules/widget/assets/back.svg"
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

Things brings the name-coordination benefits of JavaScript "packages" to all web resources.

(Does this use of separate `widget`, `widget-light`, and `widget-back-button` entries seem weird to you? Does it seem like they'd be better grouped under some sort of "package"? Read on to our next example...)

#### "Packages" via trailing slashes

It's common in the JavaScript ecosystem to have a package (in the sense of [npm](https://www.npmjs.com/)) contain multiple modules, or other files. For such cases, we want to map a prefix in the `import:`-URL space, onto another prefix in the fetchable-URL space.

Module import maps do this by giving special meaning to mappings that end with a trailing slash. Thus, a map like

```json
{
  "moment": "/node_modules/moment/src/moment.js",
  "moment/": "/node_modules/moment/src/",
  "lodash": "/node_modules/lodash-es/lodash.js",
  "lodash/": "/node_modules/lodash-es/"
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

As usual, since the module import map affects `import:` resolution generally, this package concept can be used for other resources, and in other contexts.

<details>
<summary>Here's our previous example converted to use packages:</summary>

```json
{
  "widget": "/node_modules/widget/index.mjs",
  "widget/": "/node_modules/widget/",
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

Consider the case of wanting to use a CDN's copy of a library, but fall back to a local copy if the CDN is unavailable. Today this is often accomplished via [terrible `document.write()`-using sync-script-loading hacks](https://www.hanselman.com/blog/CDNsFailButYourScriptsDontHaveToFallbackFromCDNToLocalJQuery.aspx). With module resolver maps providing a first-class way of controlling module resolution, we can do better.

To provide fallbacks, use an array instead of a string for the right-hand side of your mapping:

```json
{
  "jquery": [
    "https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js",
    "/node_modules/jquery/dist/jquery.js"
  ]
}
```

In this case, any references to `import:query` will first try to fetch the CDN URL, but if that fails, fall back to the copy in `/node_modules/`. (This fallback process will happen only once, and the choice will be cached for all future `import:` URL resolutions.)

#### For built-in modules, in module-import-map-supporting browsers

When a browser supports module import maps, we can use the same principle as the above example to support fallbacks for built-in modules.

For example, consider the following package name map, which supplies a polyfill fallback for [async local storage](https://domenic.github.io/async-local-storage/):

```json
{
  "@std/async-local-storage": [
    "import:@std/async-local-storage",
    "/node_modules/als-polyfill/index.mjs"
  ]
}
```

Now, statements like

```js
import { StorageArea } from "@std/async-local-storage";
```

will first try to resolve to `import:@std/async-local-storage`, i.e. the browser's built-in implementation of async local storage. If fetching that URL fails, because the browser does not implement async local storage, then instead it will fetch the polyfill, at `/node_modules/als-polyfill/index.mjs`.

_Potential issue: right now we require the right-hand side to be a URL. But this means you have to use the `import:` prefix on the right-hand side, and not on the left-hand side. This seems a bit confusing. Also, it opens us up to footguns: if you forget the `import:` prefix, then you're looking for the relative URL `@std/async-local-storage` (i.e., `./@std/async-local-storage`). Maybe the right hand side should be some fuzzier concept, e.g. "absolute URL or `./`-prefixed or `../`-prefixed or `/`-prefixed or built-in module specifier"? Seems less elegant, but perhaps more ergonomic._

#### For built-in modules, in browsers without module import maps

The goal of the previous example is to use a polyfill in older browsers, but the built-in module in newer browsers. But it falls down in the case of browsers that are old enough to not support module import maps at all. (That is, all of today's currently-shipping browsers.) In such cases, the statement `import { StorageArea } from "@std/async-local-storage"` will always fail, with no chance to remap it.

How can we write code that uses a polyfill in today's browsers, but uses built-in modules in future browsers that support them? We do this by changing our import statement to import the _polyfill_'s URL:

```js
import { StorageArea } from "/node_modules/als-polyfill/index.mjs";
```

and then remapping the polyfill to the built-in module for module-import-map-supporting browsers:

```json
{
  "/node_modules/als-polyfill/index.mjs": [
    "import:@std/async-local-storage",
    "/node_modules/als-polyfill/index.mjs"
  ]
}
```

With this mapping, each class of browser behaves as desired, for our above import statement:

- Browsers that do not support module import maps will receive the polyfill.
- Browsers that support module import maps, but do not support async local storage, will end up with a mapping from the polyfill URL to itself, and so will receive the polyfill anyway.
- Browsers that support both module import maps and async local storage will end up with a mapping from the polyfill URL to `import:@std/async-local-storage`, and so will receive the built-in module.

Note how we're using a capability here that we haven't explored in previous examples: remapping imports of "URL-like" specifiers, not just bare specifiers. But it works exactly the same. Previous examples changed the resolution of URLs like `import:lodash`, and thus changed the meaning of `import "lodash"`. Here we're changing the resolution of `import:/node_modules/als-polyfill/index.mjs`, and thus changing the meaning of `import "/node_modules/als-polyfill/index.mjs"`.

### Scoping examples

TODO: Not even sure what the format is now that we're more flat. Maybe do [#51](https://github.com/domenic/package-name-maps/issues/51)?

### Virtualization examples

As mentioned above, it's important to be able to wrap, extend, or remove access to built-in modules, the same way you can do with globals. The following examples show how to do this.

Many of these examples become more interesting, or useful, when combined with [scoping](#scoping), so that they only apply to some subset of your application. See that section for more details.

_Note: All of the following examples can apply to non built-in modules too. However, those cases are less interesting, as non built-in modules are already under the control of the application author. They can again become more interesting when combined with [scoping](#scoping)._

#### Denying access to a built-in module

Although it is drastic and fairly rare, sometimes it is desirable to remove access to certain capabilities from your application. With globals, this can be done via code such as

```js
delete self.WebSocket;
```

With module import maps, you can restrict access by mapping a built-in module to the special module `@std/blank`:

```json
{
  "@std/async-local-storage": "import:@std/blank"
}
```

This module has no exports, so any attempts to import from it will fail:

```js
import { Storage } from "@std/async-local-storage"; // throws, since @std/blank has no exports
```

_Question: should we introduce a module, e.g. `@std/thrower`, which just throws an exception? The difference would be in cases like `import "@std/async-local-storage"`, where you wouldn't get an exception with `@std/blank` because you're not asking for any imports. This is pretty edge-casey._

#### Wrapping a built-in module

TODO: OK scoping needs to come first

#### Extending a built-in module

TODO: OK scoping needs to come first

----
----
----

# Below here is old stuff that needs triaging

### Installing a package name map

_We're not sure exactly how you install a package name map. The below represents a tentative idea. See the issue tracker for more discussion and alternatives: [#1](https://github.com/domenic/package-name-maps/issues/1)._

You can install a package name map for your application using a `<script>` element, either inline (for best performance) or with a `src=""` attribute (in which case you'd better be using HTTP/2 push to get that thing to us as soon as possible):

```html
<script type="packagemap">
{
  "packages": { ... },
  "scopes": { ... }
}
</script>
```

```html
<script type="packagemap" src="package-map.json"></script>
```

If any bare import specifiers are encountered with no package name map present, they cause the module graph to error (as today). If a package name map is being requested, then fetching of bare modules waits for the package name map fetch.

Inserting a `<script type="packagemap">` after initial document parsing has no effect. Adding a second `<script type="packagemap">` has no effect. If the package map's JSON is not well-formed according to some relatively-strict validation criteria (see spec sketch below), it is ignored. Probably all of these cases should show up in dev tools, or even fire an `error` event at the `Window`.

_We may be able to support more than one `<script type="packagemap">`, if the use cases are compelling enough and the merging process is simple enough. Discuss in [#14](https://github.com/domenic/package-name-maps/issues/14)._

_What do we do in workers? Probably `new Worker(someURL, { type: "module", packageMap: ... })`? Or should you set it from inside the worker? Should dedicated workers use their controlling document's map, either by default or always? Discuss in [#2](https://github.com/domenic/package-name-maps/issues/2)._

### The scope of package name maps

Package maps are meant to be an application-level thing, somewhat like service workers. (More formally, they would be per-module map, and thus per-realm.) They are not meant to be composed, but instead produced by a human or tool with a holistic view of your web application. For example, it would not make sense for a library to include a package name map; libraries can simply reference packages by name, and let the application decide what URLs those packages map to.

This, in addition to general simplicity, is in part what motivates the above restrictions on `<script type="packagemap">`.

_Some have expressed a desire for multiple package maps, e.g. specified as an attribute on `<script type="module">` elements. The idea being that these separate top-level scripts should each have their own separate bare import specifier resolution rules. This is quite tricky to implement, because in actuality these scripts are not separate; they take part in the same module map. See [related discussion about `import.meta.scriptElement`](https://github.com/whatwg/html/issues/1013#issuecomment-329344476); it is essentially the same problem. To get actually separate scripts, you need to use a separate realm (e.g. via an iframe)._

Since an application's package name map changes the resolution algorithm for every module in the module map, they are not impacted by whether a module's source text was originally from a cross-origin URL. If you load a module from a CDN that uses bare import specifiers, you'll need to know ahead of time what bare import specifiers that module adds to your app, and include them in the package name map. (That is, you need to know what all of your application's transitive dependencies are.) It's important that control of which URLs are use for each package stay in control of the application author, so they can holistically manage versioning and sharing of modules.

### Example package name maps

#### Scoping package resolution

It is often the case that you want to use the same package name to refer to multiple versions of a single library, depending on who is importing them. This encapsulates the versions of each dependency in use, and avoids [dependency hell](http://npm.github.io/how-npm-works-docs/theory-and-design/dependency-hell.html) ([longer blog post](http://blog.timoxley.com/post/20772365842/node-js-npm-reducing-dependency-overheads)).

We support this use case in package name maps by allowing you to change the meaning of a specifier within a given _scope_:

_TODO: find an actual in-the-wild example of incompatible version requirements. In reality these two packages are both happy with Lodash v4. Also maybe don't use lodash since to be consistent with the rest of the document it brings along the lodash → lodash-es mapping which is orthogonal to what we're trying to show here. Help out in [#5](https://github.com/domenic/package-name-maps/issues/5)._

```json
{
  "path_prefix": "/node_modules",
  "packages": {
    "redux": { "main": "lib/index.js" },
    "html-to-text": { "main": "index.js" },
    "lodash": { "path": "lodash-es", "main": "lodash.js" }
  },
  "scopes": {
    "html-to-text": {
      "path_prefix": "node_modules",
      "packages": {
        "lodash": { "path": "lodash-es", "main": "lodash.js" }
      }
    }
  }
}
```


This produces the following mappings, with earlier rows having precedence:

|Specifier|Referrer                    |Resulting URL                                              |
|---------|----------------------------|-----------------------------------------------------------|
|lodash   |/node_modules/html-to-text/*|/node_modules/html-to-text/node_modules/lodash-es/lodash.js|
|lodash/* |/node_modules/html-to-text/*|/node_modules/html-to-text/node_modules/lodash-es/*        |
|lodash   |(any)                       |/node_modules/lodash-es/lodash.js                          |
|lodash/* |(any)                       |/node_modules/lodash-es/*                                  |

Effectively, within the `html-to-text` package, all references to the `lodash` package go to a different URL: that of the nested installation of `lodash`, in `/node_modules/html-to-text/node_modules/lodash-es`. This could be, for example, an incompatible version compared to the `lodash` found in `/node_modules/lodash-es`, which is used by the rest of the application (including inside the scope of any other packages such as `redux`).

The scope name (`"html-to-text"` here) is resolved as a relative URL to the `"path_prefix"`, giving a scope URL space (`/node_modules/html-to-text/*`) in which all submodules will have the scope applied. When a parent module matches multiple scopes, the most specific scope URL space for that parent module path will take precedence.

Notice also how the full URL path of the nested `lodash` package was composed: roughly resolving from top `"path_prefix"` → scope name → scope's `"path_prefix"` → package's `"path"`. This design minimizes repetition.

## Proto-spec

_Note: specs are serious business. What follows is still in the process of being formalized; don't judge too harshly._

### The package name map format

The package name map is a recursive JSON structure:

- A **scope** can contain a `"path_prefix"` string, a map of `"scopes"` (string → scope), and a map of `"packages"` (string → package)
- A **package** can contain a `"path"` string and a `"main"` string.
- The top-level is a scope.

Although we think using Web IDL is probably not a good idea for JSON formats, as the semantics are different, it may be helpful for implementers, so we supply the following:

```webidl
dictionary Scope {
  DOMString path_prefix;
  record<DOMString, Scope> scopes;
  required record<DOMString, Package> packages;
}

dictionary Package {
  DOMString path;
  required DOMString main;
}
```

While parsing package name maps, we validate:
- If non-strings show up where strings were expected, the map is invalid.
- If non-objects show up where objects were expected, the map is invalid.
- If the `"packages"` member is missing in a scope object, the map is invalid.
- If the `"main"` member is missing in a package object, the map is invalid.
- _TODO: there is also some invariant that needs to be enforced about non-overlapping scope URLs. Formalize it._
- _TODO: we may want to disallow some strings or characters inside strings. See [#11](https://github.com/domenic/package-name-maps/issues/11) for more discussion._

### Resolving a module specifier

_TODO: write down the algorithm for this. Follow along in [#6](https://github.com/domenic/package-name-maps/issues/6)._

## Alternatives considered

### The Node.js module resolution algorithm

Unlike in Node.js, in the browser we don't have the luxury of a reasonably-fast file system that we can crawl looking for modules. Thus, we cannot implement the [Node module resolution algorithm](https://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders) directly; it would require performing multiple server round-trips for every `import` statement, wasting bandwidth and time as we continue to get 404s. We need to ensure that every `import` statement causes only one HTTP request; this necessitates some measure of precomputation.

### A programmable resolution hook

Some have suggested customizing the browser's module resolution algorithm using a JavaScript hook to interpret each module specifier.

Unfortunately, this is fatal to performance; jumping into and back out of JavaScript for every edge of a module graph drastically slows down application startup. (Typical web applications have on the order of thousands of modules, with 3-4× that many import statements.) You can imagine various mitigations, such as restricting the calls to only bare import specifiers or requiring that the hook take batches of specifiers and return batches of URLs, but in the end nothing beats precomputation.

Another issue with this is that it's hard to imagine a useful mapping algorithm a web developer could write, even if they were given this hook. Node.js has one, but it is based on repeatedly crawling the filesystem and checking if files exist; we as discussed above, that's infeasible on the web. The only situation in which a general algorithm would be feasible is if (a) you never needed per-subgraph customization, i.e. only one version of every package existed in your application; (b) tooling managed to arrange your packages ahead of time in some uniform, predictable fashion, so that e.g. the algorithm becomes "return `/js/${specifier}.js`". But if we're in this world anyway, a declarative solution would be simpler.

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

You could imagine a package configuration format that only specified these things, or even only some subset (if we baked in assumptions for the others).

This idea does not work for more complex applications which need scoped resolution, so we believe the full package name map proposal is necessary. But it remains attractive for simple applications, and we wonder if there's a way to make the package name map proposal also have an easy-mode that does not require listing all packages, but instead relies on conventions and tools to ensure minimal mapping is needed. Discuss in [#7](https://github.com/domenic/package-name-maps/issues/7).

## Adjacent concepts

### Supplying out-of-band metadata for each module

Several times now it's come up that people desire to supply metadata for each module; for example, [integrity metadata](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), or fetching options. Although some have proposed doing this with an import statement, [careful consideration of the options](https://docs.google.com/presentation/d/1qfoLTniLUVJ5YNFrha7BaVumAnW0ZgcCfUU8UbyyuYY/edit#slide=id.p) leads to preferring an out-of-band manifest file.

The package name map is not that manifest file. It is specifically geared toward packages and bare import specifiers, leaving the rest of the application's modules (i.e. those imported via relative specifiers or absolute URLs) alone. A solution for per-module metadata needs to be encoded in a manifest file that cares about all modules, not in one that cares only about this specific case of bare import specifiers. Indeed, likely such a manifest would care about more than just JavaScript modules; all proposed metadata so far has been applicable to any sort of resource.

## More scratchwork


Given an `import:` URL _url_ and a base URL _baseURL_, we can **resolve the `import:` URL** with the following algorithm:

1. Let _path_ be _url_'s path component.
1. If _path_ starts with `/`, `./`, or `../`, then
    1. Let _resolved_ be the result of resolving _path_ relative to _baseURL_.
    1. If the package name map contains an entry for _resolved_, return that entry's value.
    1. Otherwise, return _resolved_.
1. Otherwise,
    1. If the package name map contains an entry for _path_, return that entry's value.
    1. If _path_ specifies a built-in module, return _url_.
    1. Otherwise, return null.

_TODO: this is more formal than I'd like to be at this point in the document. Can I explain it simpler, and leave the algorithm for later? The algorithm also needs to get more complex to handle fallbacks._

Some readers will notice the similarity to today's [module specifier resolution algorithm](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier), with the special handling of `/`, `./`, and `../`. Indeed, if we ignore all the package name map steps for now, we'll see that this gives us a nice tidy way of doing [URL resolution relative to the module](https://github.com/whatwg/html/issues/3871): instead of

```js
const response = await fetch(new URL('../hamsters.jpg', import.meta.url).href);
```

we can just do

```js
const response = await fetch('import:../hamsters.jpg');
```

### Module resolution modifications

In fact, we propose to reframe the existing module resolution algorithm in terms of `import:` URLs. It becomes, simply:

1. Return the result of resolving the import URL given by `import:` + _specifier_ against _baseURL_.

In othre words, `import` statements and `import()` expressions are now much more like every other part of the platform that loads resources, like `fetch()` or `<script src="">`: they operate on URLs. The only difference is that, for convenience, you omit the leading `import:`.



## Acknowledgments

This document originated out of a day-long sprint involving [@domenic](https://github.com/domenic/), [@hiroshige-g](https://github.com/hiroshige-g), [@justinfagnani](https://github.com/justinfagnani), [@MylesBorins](https://github.com/MylesBorins/), and [@nyaxt](https://github.com/nyaxt). Thank you all for your help!

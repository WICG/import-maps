# Package name maps

_Or, how to solve the web's "bare import specifier" problem_

## The basic idea

This proposal makes importing JavaScript modules via "bare import specifiers" work, using an ahead-of-time computed mapping. For example, consider the code

```js
import moment from "moment";
import { partition } from "lodash";
```

Today, this throws, as such bare specifiers [are explicitly reserved](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier). By supplying the browser with a _package name map_ of the following form

```json
{
  "path_prefix": "/node_modules",
  "packages": {
    "moment": { "main": "moment.js" },
    "lodash": { "path": "lodash-es", "main": "lodash.js" }
  }
}
```

the above would act as if you had written

```js
import moment from "/node_modules/moment/moment.js";
import { partition } from "/node_modules/lodash-es/lodash.js";
```

## Background

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

## Our solution: package name maps

A package name map is a structure, represented as JSON, which contains all the information necessary to resolve bare import specifiers across the scope of a web app.

If you are surprised by this choice of solution, you may want to briefly visit the ["Alternatives considered"](#alternatives-considered) section to read up on why we think this is the best path.

### Installing a package name map

_We're not sure exactly how you install a package name map. The below represents a tentative idea. See the issue tracker for more discussion and alternatives._

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
<script type="packagemap" href="package-map.json"></script>
```

If any bare import specifiers are encountered with no package name map present, they cause the module graph to error (as today). If a package name map is being requested, then fetching of bare modules waits for the package name map fetch.

Inserting a `<script type="packagemap">` after initial document parsing has no effect. Adding a second `<script type="packagemap">` has no effect. If the package map's JSON is not well-formed according to some relatively-strict validation criteria (see spec sketch below), it is ignored. Probably all of these cases should show up in dev tools, or even fire an `error` event at the `Window`.

_What do we do in workers? Probably `new Worker(someURL, { type: "module", packageMap: ... })`? Or should you set it from inside the worker? Should dedicated workers use their controlling document's map, either by default or always?_

### The scope of package name maps

Package maps are meant to be an application-level thing, somewhat like service workers. (More formally, they would be per-module map, and thus per-realm.) They are not meant to be composed, but instead produced by a human or tool with a holistic view of your web application. For example, it would not make sense for a library to include a package name map; libraries can simply reference packages by name, and let the application decide what URLs those packages map to.

This, in addition to general simplicity, is in part what motivates the above restrictions on `<script type="packagemap">`.

_Some have expressed a desire for multiple package maps, e.g. specified as an attribute on `<script type="module">` elements. The idea being that these separate top-level scripts should each have their own separate bare import specifier resolution rules. This is quite tricky to implement, because in actuality these scripts are not separate; they take part in the same module map. See [related discussion about `import.meta.scriptElement`](https://github.com/whatwg/html/issues/1013#issuecomment-329344476); it is essentially the same problem. To get actually separate scripts, you need to use a separate realm (e.g. via an iframe)._

Since an application's package name map changes the resolution algorithm for every module in the module map, they are not impacted by whether a module's source text was originally from a cross-origin URL. If you load a module from a CDN that uses bare import specifiers, you'll need to know ahead of time what bare import specifiers that module adds to your app, and include them in the package name map. (That is, you need to know what all of your application's transitive dependencies are.) It's important that control of which URLs are use for each package stay in control of the application author, so they can holistically manage versioning and sharing of modules.

### Example package name maps

#### Basic URL mapping

An un-fancy package name map would be as follows:

```json
{
  "packages": {
    "moment": { "path": "/node_modules/moment", "main": "moment.js" },
    "lodash": { "path": "/node_modules/lodash-es", "main": "lodash.js" }
  }
}
```

This would produce the following mappings:

|Specifier|Referrer|Resulting URL                    |
|---------|--------|---------------------------------|
|moment   |(any)   |/node_modules/moment/moment.js   |
|moment/* |(any)   |/node_modules/moment/*           |
|lodash   |(any)   |/node_modules/lodash-es/lodash.js|
|lodash/* |(any)   |/node_modules/lodash-es/*        |

#### Using `"path_prefix"` and the default `"path"`

The above package name map can equivalently be written like so:

```json
{
  "path_prefix": "/node_modules",
  "packages": {
    "moment": { "main": "moment.js" },
    "lodash": { "path": "lodash-es", "main": "lodash.js" }
  }
}
```

- `"path_prefix"` gets used as the initial path segment for the resulting URL.
- `"path"` defaults to the package name, and can be omitted when they are the same.

_We've also considered defaulting `"main"` to `packagename.js` or `index.js`, but this would basically build a default file extension for JavaScript modules into the web, which is troublesome._

_Another potential shortening is to allow e.g. `"moment.js"` as a shortcut for `{ "main": "moment.js" }`. The only downside here is that it complicates the data model by introducing a union type that needs to be normalized away._

#### Scoping package resolution

It is often the case that you want to use the same package name to refer to multiple versions of a single library, depending on who is importing them. This encapsulates the versions of each dependency in use, and avoids [dependency hell](http://npm.github.io/how-npm-works-docs/theory-and-design/dependency-hell.html) ([longer blog post](http://blog.timoxley.com/post/20772365842/node-js-npm-reducing-dependency-overheads)).

We support this use case in package name maps by allowing you to change the meaning of a specifier within a given _scope_:

_TODO: find an actual in-the-wild example of incompatible version requirements. In reality these two packages are both happy with Lodash v4. Also maybe don't use lodash since it brings along the lodash → lodash-es mapping which is orthogonal to what we're trying to show here._

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

Notice also how the full URL path of the nested `lodash` package was composed: roughly, top `"path_prefix"` + scope name + scope's `"path_prefix"` + package's `"path"`. This design minimizes repetition.

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

### Resolving a module specifier

TODO: write down the algorithm for this.

## Alternatives considered

### The Node.js module resolution algorithm

Unlike in Node.js, in the browser we don't have the luxury of a reasonably-fast file system that we can crawl looking for modules. Thus, we cannot implement the [Node module resolution algorithm](https://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders) directly; it would require performing multiple server round-trips for every `import` statement, wasting bandwidth and time as we continue to get 404s. We need to ensure that every `import` statement causes only one HTTP request; this necessitates some measure of precomputation.

### A programmable resolution hook

Some have suggested customizing the browser's module resolution algorithm using a JavaScript hook to interpret each module specifier. 

Unfortunately, this is fatal to performance; jumping into and back out of JavaScript for every edge of a module graph drastically slows down application startup. (Typical web applications have on the order of thousands of modules, with 3-4× that many import statements.) You can imagine various mitigations, such as restricting the calls to only bare import specifiers or requiring that the hook take batches of specifiers and return batches of URLs, but in the end nothing beats precomputation.

Another issue with this is that it's hard to imagine a useful mapping algorithm a web developer could write, even if they were given this hook. Node.js has one, but it is based on repeatedly crawling the filesystem and checking if files exist; we as discussed above, that's infeasible on the web. The only situation in which a general algorithm would be feasible is if (a) you never needed per-subgraph customization, i.e. only one version of every package existed in your application; (b) tooling managed to arrange your packages ahead of time in some uniform, predictable fashion, so that e.g. the algorithm becomes return `/js/${specifier}.js`. But if we're in this world anyway, a declarative solution would be simpler.

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
- The file extension used for any non-main modules (in our app, `.js`)

You could imagine a package configuration format that only specified these things, or even only some subset (if we baked in assumptions for the others).

This idea does not work for more complex applications which need scoped resolution, so we believe the full package name name proposal is necessary. But it remains attractive for simple applications, and we wonder if there's a way to make the package name map proposal also have an easy-mode that does not require listing all packages, but instead relies on conventions and tools to ensure minimal mapping is needed.

## Adjacent concepts

### Supplying out-of-band metadata for each module

Several times now it's come up that people desire to supply metadata for each module; for example, [integrity metadata](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity), or fetching options. Although some have proposed doing this with an import statement, [careful consideration of the options](https://docs.google.com/presentation/d/1qfoLTniLUVJ5YNFrha7BaVumAnW0ZgcCfUU8UbyyuYY/edit#slide=id.p) leads to preferring an out-of-band manifest file.

The package name map is not that manifest file. It is specifically geared toward packages and bare import specifiers, leaving the rest of the application's modules (i.e. those imported via relative specifiers) alone. A solution for per-module metadata needs to be encoded in a manifest file that cares about all modules, not just this specific case of bare import specifiers.

### Supplying fallbacks for host-supplied ("standard library") packages

A few efforts, such as [layered web APIs](https://github.com/drufball/layered-apis) or Keith's [module fallback imports](https://github.com/kmiller68/module-fallback-imports/) proposal, are geared toward allowing fallback to a polyfill when a host-supplied module is not present. Both of these proposals do so by modifying the `import` statement, either by using a special specifier syntax, or modifying the `import` statement syntax.

At least for the case of packages (including host-provided packages), this proposal gives an alternative: we could specify fallback URLs inside the package name map. For example,

```json
{
  "packages": {
    "moment": {
      "path": "/node_modules/moment",
      "main": "moment.js",
      "fallback_main": ["https://backupcdn1.com/moment@2.21.0/moment.js", "https://backupcdn2.com/moment@2.21.0/moment.js"]
    },
    "std:async-local-storage": {
      "fallback_main": ["https://backupcdn3.com/async-local-storage.js", "/node_modules/std-als-polyfill/index.js"]
    }
  }
}
```

The advantage of this approach, over specifying the fallback at the import site, is that it ensures every import in the application uses the _same_ fallback behavior. With specifying at the import site, it's possible for one part of the application to specify the fallback as polyfill A, whereas another part of the application specifies polyfill B, and now both of them are active on your page, bloating your application and potentially causing subtle incompatibilities.

Note that the module fallback imports syntax proposal is more general because it allows fallback for non-packages. If that's required, then the package name map is not a good fit, as discussed in the previous section on per-module metadata.

## Acknowledgments

This document originated out of a day-long sprint involving [@domenic](https://github.com/domenic/), [@hiroshige-g](https://github.com/hiroshige-g), [@justinfagnani](https://github.com/justinfagnani), [@MylesBorins](https://github.com/MylesBorins/), and [@nyaxt](https://github.com/nyaxt). Thank you all for your help!

# Import maps proto-spec

## Installation

### When import maps can be encountered

Each realm (environment settings object) has a boolean, **acquiring import maps**. It is initially true.

The [internal module script graph fetching procedure](https://html.spec.whatwg.org/multipage/webappapis.html#internal-module-script-graph-fetching-procedure) flips the boolean to false. Practically speaking, this happens when:

- Any `<script type="module">` element is connected to the document
- Any `import()` call is made
- Any worker module is created, e.g. via `new Worker(url, { type: "module" })`

Additionally, fetching any `import:` URLs will flip this boolean to false. (See below.)

If a `<script type="importmap">` is encountered when _acquiring import maps_ is false, then the developer has made an error. We will signal this by firing an `error` event on the `<script type="importmap">` element, and implementations should also display the error in the developer console.

### Acquiring import maps

Encountering a `<script type="importmap">` while _acquiring import maps_ is true will kick off a procedure roughly like this:

1. If it's an external script (i.e. has a `src=""`), fetch it, using the usual "good defaults" of `<script type="module">`. (E.g., always UTF-8, "cors" mode, MIME type must match, ...)
  - What should be the MIME type? Let's say `application/json+importmap`? Maybe accept any JSON MIME type.
1. Parse the result as JSON into a spec-level struct (see below). (Will need to solve [whatwg/infra#159](https://github.com/whatwg/infra/issues/159) as part of this.)
1. Merge the resulting struct into our realm's **merged import map** (see below).

Any **ongoing fetches of import maps** are noted, while ongoing, so that `import:` URL fetching can block on them (see below).

### Import map spec structure

A **specifier map** is a map of `import:` URLs to URLs.

An **import map** is a struct with two fields:

- **imports**: a specifier map
- **scopes**: a map of URLs to specifier maps

Getting from JSON to this structure will involve some URL parsing and type validation.

### Merging import maps

We're looking to do the minimal thing that could work here. As such, I propose the following:

Given two import maps _A_ and _B_, the merged import map is a new import map whose imports are the result of merging _A_'s imports and _B_'s imports, and whose scopes are the result of merging _A_'s scopes and _B_'s scopes. Here, merging two maps means appending their entries to each other, with any conflicting keys from the first map removed.

Example:

```json
{
  "imports": { "a": "1", "b": "2" }
}
```

+

```json
{
  "imports": { "a": "3" }
}
```

=

```json
{
  "imports": { "b": "2", "a": "3" }
}
```

Note that we do not introspect the scopes. If there's two conflicting definitions of how things behave inside a scope, then the last one wins.

## Resolution

### Modifications to the URL parser for `import:` URLs

#### Wait, what?

The URL parser is a foundational piece of the ecosystem, meant to be shared across not only the web platform, but the whole internet. So changing it should not be done lightly.

However, we have a useful precedent to follow: `blob:` URLs. `blob:` URLs are a type of browser-specific URL; they impact only the [URL parser](https://url.spec.whatwg.org/#concept-url-parser) used by web browsers, not the [basic URL parser](https://url.spec.whatwg.org/#concept-basic-url-parser) used by the rest of the internet. `import:` URLs would be similar. Also similar to for `blob:` URLs, for `import:` URLs, we need to do some parse-time association of data, in web browsers only, for better handling by the fetch algorithm later.

#### Proposed modification

Add a new field to URL records, call it **module base URL**. (Alternately, repurpose the [object](https://url.spec.whatwg.org/#concept-url-object) field used by `blob:` URLs to be something more general.)

Add some new steps to the [URL parser](https://url.spec.whatwg.org/#concept-url-parser), around `blob:` URL steps (3-5):

1. If _url_'s scheme is "`import`", set _url_'s module base URL to the [active script](https://html.spec.whatwg.org/#active-script)'s [base URL](https://html.spec.whatwg.org/#concept-script-base-url), if the active script is not null; otherwise set it to the current settings object's API base URL.

Now, the fetch algorithm (below) can consult the module base URL.

#### What does this give us?

By giving us maximum context (the active script) when resolving `import:` URLs, we get the same context-sensitivity benefits of `import` statements and `import()` expressions everywhere on the platform that `import:` URLs show up.

For example, this gives us a nice tidy way of doing [URL resolution relative to the module](https://github.com/whatwg/html/issues/3871): instead of

```js
const response = await fetch(new URL('../hamsters.jpg', import.meta.url).href);
```

we can just do

```js
const response = await fetch('import:../hamsters.jpg');
```

since the URL parser will resolve `import:../hamsters.jpg` relative to the active script, and thus fetch will receive the appropriately-resolved absolute URL.

Without these URL resolution modifications, the fetch algorithm would just receive the raw URL `import:../hamsters.jpg`. It would need to either fail the fetch, or assume that it's meant to be relative to the current settings object's API base URL, i.e. treat it as just `../hamsters.jpg`.

This is also crucial for making import maps' scopes feature work as expected with `import:` URLs. Consider the following import map:

```json
{
  "imports": {
    "lodash": "/node_modules/lodash-es/lodash.js"
  },
  "scopes": {
    "/js/different-lodash-here/": {
      "lodash": "/node_modules/underscore/underscore.js"
    }
  }
}
```

Then, inside `/js/different-lodash-here/code.mjs`, we have the following:

```js
import _ from "lodash";                                     // (1)
const source = await (await fetch("import:lodash")).text(); // (2)
```

As we know, the `_` imported in `(1)` will be from `/node_modules/underscore/underscore.js`, per the scope configuration. But what will be the result of `(2)`?

With these URL resolution modifications, it will also be from `/node_modules/underscore/underscore.js`, since we have enough context to know that we're inside the `/js/different-lodash-here/` scope. Without them, though, the fetch algorithm will only receive the raw data `import:lodash`, without any knowledge of scopes. In that case it will probably use the import map's non-scoped mapping, and retrieve `/node_modules/lodash-es/lodash.js`.

### Modifications to Fetch for `import:` URLs

We treat `import:` URLs like `blob:` URLs, in that they get a special entry in [scheme fetch](https://fetch.spec.whatwg.org/#scheme-fetch). Roughly it would do this:

1. Wait for any _ongoing fetches of import maps_.
1. Let _url_ be _request_'s current URL.
1. Let _baseURL_ be _url_'s module base URL.
1. Let _specifier_ be _url_'s path.
1. Let _underlyingURL_ be null.
1. If _specifier_ starts with `/`, `./`, or `../`, then set _underlyingURL_ to the result of URL-parsing _specifier_ with _baseURL_ as the base URL.
    - This is recursive. Should we just use the basic URL parser? Need to explore the consequences.
1. Otherwise, set _underlyingURL_ to the the result of consulting the current realm's merged import map, given _specifier_ and _baseURL_. (_baseURL_ is used to determine what scope we're in.)
    - This should return nothing for built-in modules by default, i.e., unless they have been remapped, you can't fetch their source code.
1. "Do a request to _underlyingURL_". Details unclear; things to consider:
    - Should we just change _request_'s current URL?
    - Should we make this behave like a redirect of some sort? (Probably a bad idea.)
    - Should we mandate all `import:`-based requests use CORS/etc.? In that case we'd probably recreate a request from scratch.
    - Should we restrict to GETs like `blob:` does?
    - Should _baseURL_ be the referrer, or should we use the referrer we're given in _request_?

TODO: this needs to loop for fallbacks

### Consulting the import map

Given a import map _M_, a specifier _specifier_, and a base URL _baseURL_:

... TODO ...

Trickier parts will be scopes and trailing-slash packages, as both are somewhat unprecedented in the web's URL handling.

### Resolve a module specifier

I think with all the above in place, the current spec's "resolve a module specifier" can be reduced to just prepending `import:`? Hmm, but the "active script" isn't exactly the same as the _base URL_ passed to that... TODO...

## More TODOs

Should we perform more validation besides URL parsing and type checking? E.g. should we restrict to valid URL characters, at least on the left-hand side?

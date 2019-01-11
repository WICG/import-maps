# Import maps proto-spec

_Note: we also have a slightly-less-proto spec at https://domenic.github.io/import-maps/. We're sorry that it's confusing to have two spec-like documents; we'll merge the contents of this one into that location soon. At this point in time, that one is more rigorous but covers less behavior._

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

For now, see the [reference implementation](https://github.com/domenic/import-maps/tree/master/reference-implementation) to understand how an arbitrary string gets turned into a normalized "import map" structure. This will soon be ported to formal specification text, after a bit more validation that it works correctly.

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

The new "resolve a module specifier" algorithm is prototyped in the [reference implementation](https://github.com/domenic/import-maps/tree/master/reference-implementation). It takes as input a specifier, a parsed import map, and a script URL that the specifier is being resolved in the context of.

For now we will only handle cases where there is at most one fetch-scheme URL in the address array. Cases involving multiple such URLs (such as the [fallbacks for user-supplied packages](./README.md#for-user-supplied-packages) example) require more thought on how to thread through the spec. This corresponds to working through all but the last bullet in the README's section on [further implementation staging](./README.md#further-implementation-staging)

## `import:` URL fetches

_Unlike previous versions of the proto-spec, `import:` URLs no longer involve changes to the URL parser._

We treat `import:` URLs like `blob:` URLs, in that they get a special entry in [scheme fetch](https://fetch.spec.whatwg.org/#scheme-fetch). Roughly it would do this:

1. Wait for any _ongoing fetches of import maps_.
1. Let _url_ be _request_'s current URL.
1. Let _baseURL_ be _request_'s referrer, post-processed to convert "client" into the actual client URL.
1. Let _specifier_ be _url_'s path.
1. Let _underlyingURL_ be the result of "resolve a module specifier" given _baseURL_ and _specifier_.
1. "Do a request to _underlyingURL_". Details unclear; things to consider:
    - Should we just change _request_'s current URL?
    - Should we make this behave like a redirect of some sort?
    - Should we mandate all `import:`-based requests use CORS/etc.? In that case we'd probably recreate a request from scratch.
    - Should we restrict to GETs like `blob:` does?

## TODO: multiple fetch-scheme URL fallbacks

Not sure yet how to handle this. Current thinking is maybe in those cases "resolve a module specifier" returns a list of URLs, but threading that through is hard.

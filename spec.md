# Import semantics yet to be specified

The spec for import maps is located at https://wicg.github.io/import-maps/. This document contains notes on things that will eventually be formalized and make their way into the spec.

## Merging import maps

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

## `import:` URL fetches

_Unlike in previous import map proposals, `import:` URLs no longer involve changes to the URL parser._

Fetching an `import:` URL is like fetching a module in that it flips the [acquiring import maps](https://wicg.github.io/import-maps/#environment-settings-object-acquiring-import-maps) boolean to false.

We treat `import:` URLs like `blob:` URLs, in that they get a special entry in [scheme fetch](https://fetch.spec.whatwg.org/#scheme-fetch). Roughly it would do this:

1. [Wait for import maps](https://wicg.github.io/import-maps/#wait-for-import-maps).
1. Let _url_ be _request_'s current URL.
1. Let _baseURL_ be _request_'s referrer, post-processed to convert "client" into the actual client URL.
1. Let _specifier_ be _url_'s path.
1. Let _underlyingURL_ be the result of [resolve a module specifier](https://wicg.github.io/import-maps/#resolve-a-module-specifier) given _baseURL_ and _specifier_.
1. "Do a request to _underlyingURL_". Details unclear; things to consider:
    - Should we just change _request_'s current URL?
    - Should we make this behave like a redirect of some sort?
    - Should we mandate all `import:`-based requests use CORS/etc.? In that case we'd probably recreate a request from scratch.
    - Should we restrict to GETs like `blob:` does?

## Multiple fetch-scheme URL fallbacks

Not sure yet how to handle this. Current thinking is maybe in those cases [resolve a module specifier](https://wicg.github.io/import-maps/#resolve-a-module-specifier) returns a list of URLs, but threading that through is hard.

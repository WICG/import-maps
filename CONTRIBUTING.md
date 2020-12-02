# Contribution Details

## Joining WICG

This repository is being used for work in the W3C [Web Platform Incubator Community Group](https://www.w3.org/community/wicg/) (WICG), governed by the [W3C Community License Agreement (CLA)](http://www.w3.org/community/about/agreements/cla/). To make substantive contributions, you must join the Community Group, thus signing the CLA.

## Editing the specification

Edits to the specification are done in the `spec.bs` file, which is then compiled with the [Bikeshed](https://tabatkins.github.io/bikeshed/) spec pre-processor.

To build the specification, you can use one of:

- `make local`: uses a locally-installed copy of Bikeshed
- `make remote`: uses a Bikeshed web service, so you don't have to install anything locally

## Reference implementation

We maintain a reference implementation in the [`reference-implementation/`](https://github.com/WICG/import-maps/tree/master/reference-implementation) subfolder. This reference implementation, along with its tests, is meant to co-evolve along with the specification and stay in sync.

## Tests

This specification has [web platform tests](https://github.com/web-platform-tests/wpt), in the [`import-maps/`](https://github.com/web-platform-tests/wpt/tree/master/import-maps) subdirectory. All normative specification updates need accompanying web platform test changes.

Tests for parsing and resolution are driven by [JSON files](https://github.com/web-platform-tests/wpt/tree/master/import-maps/data-driven/resources), in a [documented format](https://github.com/web-platform-tests/wpt/tree/master/import-maps/data-driven). This repository also contains a copy of these files in [`reference-implementation/__tests__/json`](https://github.com/WICG/import-maps/tree/master/reference-implementation/__tests__/json). Currently this repository and the web platform tests repository are synchronized manually.

## For maintainers: identifying contributors to a pull request

If the author is not the sole contributor to a pull request, please identify all contributors in the pull request comment.

To add a contributor (other than the author, which is automatic), mark them one per line as follows:

```
+@github_username
```

If you added a contributor by mistake, you can remove them in a comment with:

```
-@github_username
```

If the author is  making a pull request on behalf of someone else but they had no part in designing the feature, you can remove them with the above syntax.

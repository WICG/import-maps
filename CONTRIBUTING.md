# Contribution Details

## Joining WICG

This repository is being used for work in the W3C [Web Platform Incubator Community Group](https://www.w3.org/community/wicg/) (WICG), governed by the [W3C Community License Agreement (CLA)](http://www.w3.org/community/about/agreements/cla/). To make substantive contributions, you must join the Community Group, thus signing the CLA.

## Editing the specification

The specification is now maintained as part of the HTML Standard, in [whatwg/html](https://github.com/whatwg/html). Small updates are best done as a pull request against that repository. Large feature proposals might work well being incubated in this repository; we can discuss on the issue tracker about adding a specification document here for such incubations.

## Reference implementation

We maintain a reference implementation in the [`reference-implementation/`](https://github.com/WICG/import-maps/tree/main/reference-implementation) subfolder. This reference implementation, along with its tests, is meant to co-evolve along with the specification and stay in sync.

## Tests

This specification has [web platform tests](https://github.com/web-platform-tests/wpt), in the [`import-maps/`](https://github.com/web-platform-tests/wpt/tree/master/import-maps) subdirectory. All normative specification updates need accompanying web platform test changes.

Tests for parsing and resolution are driven by [JSON files](https://github.com/web-platform-tests/wpt/tree/master/import-maps/data-driven/resources), in a [documented format](https://github.com/web-platform-tests/wpt/tree/master/import-maps/data-driven). When running tests in this repository, those JSON files are automatically downloaded by the `pretest` npm script. The version downloaded is pinned to a specific commit, which is updated by modifying [the script](https://github.com/WICG/import-maps/blob/main/reference-implementation/__tests__/sync-tests.js).

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

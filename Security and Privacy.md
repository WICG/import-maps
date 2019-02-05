# Security and Privacy Questionnaire Answers

The following are the answers to the W3C TAG's [security and privacy self-review questionnaire](https://www.w3.org/TR/security-privacy-questionnaire/).

## A note on threat models

Import maps are explicitly designed to be installed by page authors, i.e. those who have the ability to run first-party scripts. (See the README's ["Scope" section](./README.md#scope).) Although it may seem that the ability to change how resources are imported from JavaScript is powerful, there is no extra power really granted here. That is, they only change things which the page author could change already, by manually editing their code to use different URLs, or by adding asynchronous try/catch fallback processing.

## Answers

**Does this specification deal with personally-identifiable information?**

No. This specification only deals with developer-supplied information, not user-supplied.

**Does this specification deal with high-value data?**

No, except insofar as developers who already have access to high-value data can choose to store that data in modules, and this affects how modules can be processed. For that, see the threat model discussion above.

**Does this specification introduce new state for an origin that persists across browsing sessions?**

No. Unlike service workers, import maps are re-processed each page load. (They can be stored in the HTTP cache, but that is not a new mechanism.)

**Does this specification expose persistent, cross-origin state to the web?**

No.

**Does this specification expose any other data to an origin that it doesn’t currently have access to?**

No, is the plan.

There are some open questions about the potential design of HTTPS → HTTPS fallback cases ([example such case](https://github.com/WICG/import-maps/blob/master/README.md#for-user-supplied-packages)), especially when combined with `import:` URLs in contexts like `<link>` or `<img>` that do not respect the same-origin policy. If specified and implemented naïvely, these could give rise to the ability to determine the network status of resources in ways that might be new. See more discussion in [#76](https://github.com/WICG/import-maps/issues/76).

However, we will be sure to solve this before finalizing any specification for these features. Note that both HTTPS → HTTPS fallback and `import:` URLs are "advanced" parts of import maps, that may not be part of initial implementations, per the ["Implementation notes" section of the README](./README.md#implementation-notes).

**Does this specification enable new script execution/loading mechanisms?**

Not really. This modifies the existing mechanism of JavaScript module imports, and makes [built-in modules](https://github.com/tc39/proposal-javascript-standard-library/) more feasible by allowing them to be polyfilled and virtualized. But it's all squarely inside the JavaScript module system.

**Does this specification allow an origin access to a user’s location?**

No.

**Does this specification allow an origin access to sensors on a user’s device?**

No.

**Does this specification allow an origin access to aspects of a user’s local computing environment?**

No.

**Does this specification allow an origin access to other devices?**

No.

**Does this specification allow an origin some measure of control over a user agent’s native UI?**

No.

**Does this specification expose temporary identifiers to the web?**

No.

**Does this specification distinguish between behavior in first-party and third-party contexts?**

Yes. Import maps only affect the current realm, which I believe meets the definition of first-party.

**How should this specification work in the context of a user agent’s "incognito" mode?**

No changes, besides perhaps those implied by other aspects of incognito mode (like how it builds on modified HTTP cache behavior).

**Does this specification persist data to a user’s local device?**

No, apart from via the HTTP cache.

**Does this specification have a "Security Considerations" and "Privacy Considerations" section?**

When we have a full specification, we'll be sure to include one, likely drawn from this document!

**Does this specification allow downgrading default security characteristics?**

No.

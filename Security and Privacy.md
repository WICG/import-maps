# Security and privacy questionnaire answers

The following are the answers to the W3C TAG's [security and privacy self-review questionnaire](https://www.w3.org/TR/security-privacy-questionnaire/).

**Does this specification deal with personally-identifiable information?**

No. This specification only deals with developer-supplied information, not user-supplied.

**Does this specification deal with high-value data?**

No, except insofar as developers who already have access to high-value data can choose to store that data in modules, and this affects how modules can be processed. For that, see the threat model discussion in the spec.

**Does this specification introduce new state for an origin that persists across browsing sessions?**

No. Unlike service workers, import maps are re-processed each page load. (They can be stored in the HTTP cache, but that is not a new mechanism.)

**Does this specification expose persistent, cross-origin state to the web?**

No.

**Does this specification expose any other data to an origin that it doesn’t currently have access to?**

No, is the plan.

There are some open questions about the potential design of future work that leverages import maps to support HTTPS → HTTPS fallback cases ([see README for more detail](https://github.com/WICG/import-maps/blob/main/README.md#fallback-support)), especially when combined with another future feature, [`import:` URLs](https://github.com/WICG/import-maps/blob/main/README.md#import-urls), in contexts like `<link>` or `<img>` that do not respect the same-origin policy. If specified and implemented naïvely, these could give rise to the ability to determine the network status of resources in ways that might be new. See more discussion in [#76](https://github.com/WICG/import-maps/issues/76).

However, we will be sure to solve this before finalizing any specification for these future features.

**Does this specification enable new script execution/loading mechanisms?**

Not really. This modifies the existing mechanism of JavaScript module imports, but as discussed in the spec, it doesn't fundamentally change such loading, instead just providing a translation layer.

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

Yes.

**Does this specification allow downgrading default security characteristics?**

No.

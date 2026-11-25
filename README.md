# Config Provenance

Merge flat configuration layers and explain each effective value without showing marked secrets.

**Status:** implemented browser-local research prototype. Automated tests can be reproduced with the command below. The existing GitHub Pages site previously passed smoke checks; the current validation update has local test coverage only. Its live deployment and browser behavior have not yet been verified.

## Website

Live website: https://royalpuskar.github.io/config-provenance/

## Problem and approach

Developers often combine defaults and environment-specific configuration without knowing which layer supplied an effective value. This tool applies last-layer-wins overrides and records the assignment path for each key. It runs the same pure JavaScript engine in the browser and Node tests. All input is provided by the user or the included synthetic fixture; no external facts are inferred.

## Implemented features

- Editable scenario with a synthetic example and reset control.
- Deterministic analysis, summary metrics, filterable result table, and JSON report export.
- Input validation, explicit errors, and invalidation of outdated reports after edits.
- Keyboard-accessible controls, responsive layout, and large-screen CSS.
- Zero runtime dependencies and no external API calls.

## Install and run

Requirements: Python 3 for a static local server, Node.js 22 or later for tests.

```sh
git clone https://github.com/Royalpuskar/config-provenance.git
cd config-provenance
python3 -m http.server 8000
```

Open http://localhost:8000. Do not open index.html through a file URL; ES modules require a server.

```sh
node --test test.mjs
```

## Example and schema

The complete example in `sample.mjs` defines the supported input shape:

```json
{
  "secretKeys": [
    "token"
  ],
  "layers": [
    {
      "name": "defaults",
      "values": {
        "port": 8000,
        "token": "SYNTHETIC"
      }
    },
    {
      "name": "local",
      "values": {
        "port": 9000
      }
    }
  ]
}
```

Edit one value and select **Run analysis**. **Reset example** restores the fixture. **Export report** downloads the current result; it never publishes it.

The root must contain exactly `secretKeys` and `layers`; each layer must contain exactly `name` and `values`. Values must be flat JSON scalars: strings, finite numbers, booleans, or null. Nested objects and arrays are rejected, including under secret-marked keys. Names and secret-key declarations must be nonempty text of at most 100,000 characters. Each input array is limited to 500 items and the normalized input to 200,000 serialized characters. The browser also limits raw editor input to 200,000 characters. These are character limits, not byte limits. Direct module calls must use plain data objects and arrays without accessor entries; JavaScript proxies are outside this API contract.

## Architecture and request flow

`index.html` loads `app.mjs`, which parses scenario JSON and calls `run` from `engine.mjs`. The engine returns `metrics`, `rows`, `unmatchedSecretKeys`, and value-free `provenance`. Each row includes a zero-based `sourceIndex`; provenance assignments include layer indices so repeated names remain distinguishable. Unmatched secret-key declarations are deduplicated and sorted to help detect misspellings. The UI displays these diagnostics in the raw report and summary metrics; the UI renders values with `textContent`, never user-supplied HTML. Editing invalidates the prior report. Export creates a local Blob download.

There is no application authentication, credential store, session cookie, or token lifecycle. GitHub Pages serves public static files. The app does not collect passwords or API keys, contact third-party APIs, persist inputs, or send scenario data over the network. GitHub hosting can still receive ordinary page request metadata. Reloading discards edits.

## Limitations

Flat key override semantics only. Secret-key matching compares JavaScript `toLowerCase()` results; it is case-insensitive but does not normalize Unicode or detect confusable characters, and it does not scan values for secret-like content. Marked values never enter report rows or provenance, including overridden values. Keys, layer names, and unmatched declarations are public report metadata: do not put credentials in them. Unmarked scalar values are included in reports. The input editor still contains the original values until edited or reloaded; redaction is not secure memory erasure. JSON syntax errors use a generic message rather than echoing parser snippets.

The interface shares a portfolio design system, while this repository has its own domain engine, fixture, and tests. No accuracy, novelty, production-readiness, or 4K visual-test claim is made. Large-screen CSS is not a substitute for device testing.

## Validation

Ten local Node tests pass for this update. They cover the synthetic nested-secret regression, case-insensitive secret-key matching, repeated layer names, overridden secret values, unmatched declarations, falsy values and prototype-named keys, non-JSON values, accessor rejection, deterministic results, input preservation, and size limits. Before the nested-value fix, a nested `service.token` value appeared in a report despite `token` being declared secret; the same input now fails with a value-free schema error. The added case-variant test confirms `ApiToken`, `apitoken`, and `APITOKEN` values are all redacted when `ApiToken` is declared. These are reproducible regression results, not a security benchmark. Browser, mobile, and 3840×2160 checks have not been rerun for this update.

`test.mjs` checks domain outcomes and edge cases, deterministic behavior, input preservation, malformed roots, and size limits. GitHub Actions runs the same suite. Review the tests themselves to see exactly what is covered; passing these checks does not establish security or exhaustive correctness.

## Roadmap

- Add more independently reviewed domain fixtures and explicit schema documentation.
- Add domain-specific form controls alongside the JSON editor.
- Expand accessibility and mobile browser testing.
- Revisit the documented domain limitations before production use.

## Contribution and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).

© 2026 Puskar (Royalpuskar). All rights reserved except permissions granted by the MIT license. Preserve applicable third-party notices.



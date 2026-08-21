# Security Architecture

## What “protected code” means

Client-side encryption cannot keep a secret from the browser that must execute it. AITRACEROOT therefore uses layered protection:

- **Architectural secrecy:** credentials, scoring weights and provider logic stay server-side.
- **Build hardening:** minification, tree shaking, symbol rewriting, string indirection and no source maps.
- **Integrity:** content-addressed filenames derived from SHA-256.
- **Transport:** production APIs are expected to use HTTPS and secure cookies.
- **Data minimization:** the public client stores no seed phrases or provider keys.

Obfuscation raises reverse-engineering cost; it is not cryptographic confidentiality. This distinction is intentional and is part of the threat model.

## Trust boundaries

The browser is untrusted. All authorization, quotas, validation and sensitive computation must be repeated or exclusively performed on the server. Third-party provider responses are also untrusted and normalized before they reach UI modules.

## Release checklist

- Scan tracked files and history for secrets
- Verify dependency lockfile and audit findings
- Run lint, type checks, tests and production build
- Confirm source maps are absent
- Confirm API traffic is same-origin and authenticated routes are not service-worker cached
- Record the release commit SHA


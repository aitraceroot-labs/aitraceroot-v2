# Security Policy

Please report vulnerabilities privately to the project maintainers. Do not open a public issue containing credentials, exploitable endpoints or user data.

## Scope

The public repository contains the showcase frontend and reproducible production build. Provider credentials, server configuration, private scoring models, deployment access and user data are out of scope and are never committed.

## Baseline controls

- No secrets in client code or Git history
- Same-origin API calls and secure server-side provider access
- Content-addressed production assets
- No production source maps
- Lockfile-pinned dependencies
- Input-safe rendering utilities
- Authentication and authorization enforced by the backend

If you discover a leaked secret, treat it as compromised and rotate it immediately; removing it from the latest commit is not sufficient.


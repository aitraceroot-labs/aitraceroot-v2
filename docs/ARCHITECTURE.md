# Architecture

AITRACEROOT uses a modular browser architecture designed for fast iteration without a large runtime framework.

```text
Browser shell
  ├─ Router and application lifecycle
  ├─ Shared terminal layout
  ├─ Page modules
  │   ├─ Markets / Token / Futures
  │   ├─ Smart Money / Wallet / Risk
  │   └─ Alpha / Chat / Profile
  ├─ Service boundary
  │   ├─ Same-origin REST API
  │   └─ Token media resolution
  └─ UI foundations
      ├─ Safe rendering and formatting
      ├─ State store
      └─ Design tokens
```

The public client performs presentation and interaction. Aggregation, credentials, proprietary ranking and provider failover remain server-side. This separation prevents the common Web3 mistake of shipping valuable secrets in a minified browser bundle.

Production builds bundle route dependencies, remove dead code, minify CSS and JavaScript, omit source maps, obfuscate first-party entry code, and rename outputs with a SHA-256-derived content hash.


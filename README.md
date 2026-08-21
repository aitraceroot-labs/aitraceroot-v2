# AITRACEROOT V2

> AI-native crypto market and on-chain intelligence terminal.

AITRACEROOT turns fragmented market, derivatives, wallet and risk data into one decision surface for crypto researchers and active traders. The terminal combines multi-chain discovery, Smart Money tracking, contract risk signals, derivatives context and an AI research assistant in a fast installable web application.

## BNB Chain integration

AITRACEROOT is built for the BNB Chain ecosystem and supports BSC, also known as BNB Smart Chain. Its public product scope covers market analysis, on-chain data, wallet analysis and risk monitoring across supported assets and networks.

## Why it matters

Crypto research is still split across explorers, charting tools, social feeds and spreadsheets. AITRACEROOT reduces that context switching with a unified workflow: discover an asset, validate its market structure, inspect wallet behavior, check contract risk, then continue the investigation with an AI assistant.

## Product surfaces

- Market overview and token discovery
- Multi-timeframe terminal charts
- Smart Money and wallet intelligence
- Contract and token risk workspace
- Futures, funding and derivatives context
- Alpha radar and watchlists
- AI research assistant
- Responsive PWA experience

## Quick start

```bash
npm ci
npm test
npm run build
npm run preview
```

The preview server prints the local URL. Production output is generated in `dist/v2`.

## Protection model

The browser bundle is not treated as a secret boundary. Production builds use minification, tree shaking, hashed assets and targeted obfuscation to increase reverse-engineering cost. API credentials, proprietary scoring weights and provider orchestration belong on the server and are intentionally excluded from this repository. See [Security Architecture](docs/SECURITY-ARCHITECTURE.md).

## Architecture

The frontend uses native ES modules with a small state layer, route-level page modules, isolated services and reusable terminal components. Build output is deterministic and content-addressed. See [Architecture](docs/ARCHITECTURE.md) and [Data Flow](docs/DATA-FLOW.md).

## Event kit

Materials for hackathons, grants and ecosystem quests are under `docs/event/`, including a submission draft, demo script, judging map and roadmap.

## Status

This repository is a public showcase edition. Live providers and private backend intelligence modules are operated separately. Nothing here is financial advice.

## License

Copyright © 2026 AITRACEROOT. Source-available under the terms in [LICENSE](LICENSE).

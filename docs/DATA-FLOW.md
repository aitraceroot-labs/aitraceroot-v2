# Data Flow

1. A user selects a market, token, wallet or research workflow.
2. The route module requests normalized data through the same-origin service layer.
3. The private backend selects providers, applies rate limits and normalizes schemas.
4. Risk and intelligence engines enrich the response with explainable signals.
5. The client validates response shape and renders escaped, formatted output.
6. Short-lived cache policies improve responsiveness without caching authenticated API traffic in the service worker.

Wallet connection is optional for research. The application never requires a seed phrase or private key. Transaction signing, where supported, remains inside the user-selected wallet.


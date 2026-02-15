# Cloudflare Deployment Notes

## Build output

Deploy the `field-site` folder as the site root.

## Required cache behavior

The `_headers` file in this folder already sets:

- `no-cache` for `index.html`, `sw.js`, `manifest.json`, `version.json`
- short cache (`max-age=300`) for `/assets/*`

## After each deployment

1. Increment `version.json` (`version` and `releasedAt`).
2. Update `CACHE_VERSION` in `sw.js`.
3. Deploy to Cloudflare.
4. If old content appears, run selective cache purge for:
   - `/index.html`
   - `/sw.js`
   - `/manifest.json`
   - `/version.json`

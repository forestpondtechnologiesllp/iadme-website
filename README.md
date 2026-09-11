# iAdMe website

Static HTML, CSS and JavaScript served by the existing Cloudflare Pages project `iadme-website`. Pushing `main` publishes the site. No frontend build step is required.

## Public pages

- `/` — premium campaign homepage and featured films
- `/discover` — product introduction, app preview and Targets FAQs
- `/films` — all nine finished campaign films, with category filters
- `/share` — app sharing link, QR downloads, four posters and print PDF
- `/get` — mobile store routing and desktop store-choice page

Existing company, policy, account-deletion, advertising and administration pages remain in place. The video share route in `functions/v/[videoId].js` and mobile association files in `.well-known` are preserved.

## Campaign assets

`assets/campaign/site.css` and `site.js` power the new public pages. HTML remains directly editable. Fonts are self-hosted; their open-source license files are in `assets/campaign/fonts`.

The nine MP4s in `assets/campaign/films` are web copies of the final approved edits from 11 September 2026. They retain full duration, the centered CTA where present, the icon watermark and the original AAC audio. They use H.264 at 720px width with the MP4 metadata at the beginning for progressive playback. Video is requested only after a visitor chooses a film; there is one player, with no automatic background playback. Six narrated films have separate English WebVTT caption files. The other three use music and on-screen text.

The public share ZIP contains final JPG posters, the print PDF, QR assets and share text. High-resolution poster PNGs are available separately. It intentionally contains no local production scripts, credentials, review reports or source prompts. All QR codes point to `https://iadme.app/get`.

Campaign stories are fictional dramatizations and app demonstrations use illustrative content. Raw city videos and local production footage are not deployed.

## Updating content

Update the matching card attributes in `index.html`, `films.html` or `discover.html` when replacing a film. Keep its `.mp4`, `-poster.jpg` and optional `.vtt` paths aligned. The anchor itself is a direct-video fallback; JavaScript opens it in an accessible dialog with native controls.

The smart-link destinations are defined in `assets/get/get.js`, with direct store links also present in `get.html` and the public page download sections. Keep them consistent if the app listings move. Preserve `/get` so already-printed QR codes keep working.

## Verification

Before publishing, verify desktop and mobile layouts, every film and its available captions, no media download before playback, keyboard navigation/dialog focus, link copying and fallback, film filters, downloadable assets, and `/get` routing. Keep each deployed asset under Cloudflare Pages’ current per-file limit. See the [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) for the current platform requirements.

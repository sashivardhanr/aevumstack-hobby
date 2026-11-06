# AEVUM / SIGNAL

Isolated brand-and-hero experiment. Not approved for integration. No application entry,
backend, business offer or legal page is changed. The previous untracked Living System
prototype is preserved byte-for-byte in `archive/violet-study/`.

## Preview

From the repository root:

```sh
python3 -m http.server 4185 --bind 127.0.0.1 --directory experiments/living-system
```

Open http://127.0.0.1:4185/ (hero) or http://127.0.0.1:4185/identity.html
(monochrome studies and selected outlined wordmark). Stop the owned server with Ctrl-C.
The directory is outside Vite's frontend root and build entries.

## Identity and composition

Selected study 01: **Open aperture**. A square core, asymmetric frame and returning
sweep. The emblem and custom wordmark are outlined SVGs, independent of web fonts.
`assets/wordmark.svg` is for light surfaces; `assets/wordmark-light.svg` is for dark.
`assets/favicon.svg` retains the silhouette at 16px. Studies 02/03 are alternatives,
not additional proposed identities.

Carbon `#0B0D10`, steel `#192127`, mineral white `#F3F0E8`, signal vermilion `#FF5C40`,
mist `#AAB2B8`. Supporting neutrals and a darker vermilion punctuation color provide
text contrast. Space Grotesk carries the editorial hierarchy; Inter handles readable
UI copy; system monospace is reserved for subordinate technical labels.

The light editorial masthead leads into one continuous dark workbench. The framed
website, unframed booking interface and steel automation panel intentionally have
unequal compositions. Mobile uses a vertical signal rail, a shorter website preview,
compact booking composition and reduced repeated copy. It remains a scrolling
walkthrough, not a single-screen mobile hero.

## Interaction and boundaries

“Run the signal” or the fictional website's “Find a time” starts a finite 5.55-second
illustration. The signal reaches booking before its receipt changes, then reaches
automation before three operations complete in order. Replay is available afterward.
No requests, storage, actual reservation, email or customer data. Both contact links
are explicit `mailto:` links; automated checks do not activate them.

Reduced motion shows the completed state immediately. Leaving the workbench or hiding
the tab cancels pending timers. No idle animation loop or animation dependency.
Without JavaScript, the story remains visible and inactive controls remain hidden.
Google Fonts is the only external presentation resource; system font fallback and
font-independent identity are checked.

## Focused verification

With the preview running and the repository's existing Node/Playwright available:

```sh
node --check experiments/living-system/system.js
node experiments/living-system/verify.mjs
```

The verifier uses Chromium and WebKit, tests 320/390/768/1440px reflow, finite stage
progression, timing of arrivals, keyboard focus, minimum control dimensions,
reduced motion, no-JavaScript/font-failure fallback, no interaction requests or
browser storage, offscreen cancellation and core text/control contrast. It writes
the three intentional review captures to `previews/`.

Final local run: 70 assertions passed, exit 0. Core tested contrast pairs range from
4.86:1 to 17.09:1. These checks are not a complete WCAG certification. No Firefox,
physical-device or screen-reader speech test was performed. No application build,
Docker, SMTP, database or full integration suite is needed for this buildless experiment.

## Review status

Desktop, mobile and completed-state screenshots are in `previews/`. The original
mark is a design proposal; visual approval is still required. The mobile walkthrough
remains tall, and static images cannot convey signal timing. Evaluate the live sequence
before deciding whether to integrate any part of the experiment.

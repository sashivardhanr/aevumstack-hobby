# Phase 5E visual, motion and accessibility QA

**Recommendation: ready for a local Phase 5D checkpoint.** Chromium verification found no blocker in the motion changes. Keep release approval separate from the checkpoint. Actual Safari, Firefox, a physical Android device and screen-reader announcements remain unverified.

## Visual quality and conversion review

The first fold states the offer and audience clearly. The crimson project CTA has priority, and the work and pricing links offer distinct next steps. The headline and CTA settle reads as one entrance. The dial anchors the composition without asking the visitor to interact. At 390 px the headline stays at two lines, the CTA is visible, and Selected Work starts within the 844 px view. At 768 px the two-column hero keeps copy and dial together. At desktop the larger dial gives the copy room without overpowering it.

Selected Work provides credible evidence of how the studio designed its own enquiry journey. It is appropriately labeled as self-initiated. The fictional Booking Desk gives visitors something concrete to try. Confirmation and the operator queue explain the result without implying that a real booking or enquiry was sent. The service descriptions distinguish the capabilities, while visible pricing and native disclosures make scope easier to scan. The portfolio would benefit from permissioned screenshots or client work when available. The existing evidence does not establish client outcomes.

The short hover lifts and feedback settles fit the graphic language. The process step numbers and work intro can replay while reversing scroll because their progress follows the viewport. The movement is small and does not hide text. Keep an eye on it in physical-device review. The disclosures and error feedback still make sense with motion disabled.

## Cross-browser matrix

| Engine or device | Status | Coverage and limits |
|---|---|---|
| Chromium via Brave | Passed | Actual build, hero and Selected Work, native view-timeline capability, hover and focus, booking, package/support disclosures, contact and mobile navigation. Home, Privacy and Terms inspected. |
| Chromium with view-timeline rules removed | Passed | Removed the supported view-timeline block in the browser. Work intro and all four step numbers remained visible at full opacity with no animation. This exercises the fallback path in Chromium. |
| Safari/WebKit | Unverified | Safari is installed. Native app control timed out. SafariDriver rejected the session because Allow remote automation is disabled (exit 2). Settings were left as found. |
| Firefox | Unavailable | No installed browser or cached Playwright Firefox build was available. |
| Physical mid-range Android | Unavailable | Touch behavior checked with Chromium emulation. GPU, browser chrome, on-screen keyboard and physical gestures remain outside the evidence. |

## Responsive and accessibility findings

- Chromium checked widths of 320, 390, 699, 700, 768, 1024, 1279, 1280 and 1440 px with production fonts loaded. No horizontal overflow was detected. The primary CTA remained above the fold. Its top was 387, 381 and 503 px at the three target widths respectively.
- The main hero and booking actions, package disclosure summaries and contact submit measured at least 44 px high in the target configurations. The visible mobile menu toggle measured 46×46 px. This is sampled geometry, not a site-wide touch-target audit.
- Skip link was first in keyboard order. Drawer checks covered Escape, focus restoration and link close. Disclosure checks used native summary activation. Validation focused the first invalid field. Focus outlines and textual status remain available independently of motion.
- Reduced motion disabled the new transitions and keyframes and restored immediate scrolling. With JavaScript disabled, headline, work link and native disclosures were still available. The demo retains its existing static explanation with JS disabled.
- Booking uses an existing status region. Contact exposes success, fallback and error semantics and updated the matching content during the mocked journey. This verifies DOM behavior, not spoken announcements. Test actual VoiceOver delivery of confirmation and validation messages before release.
- Sampled token contrast: white on the crimson CTA 5.12:1, light crimson on near-black 9.09:1, booking secondary text on graphite 9.35:1, and light focus outline on graphite 10.82:1. The booking control border is 2.97:1 against its fill. Native radios and focus indicators supply additional cues. This was not a comprehensive contrast or WCAG conformance audit.

## Performance compared with Phase 5B

Measured the frozen Phase 5B build and a fresh Phase 5D build using the same local Chromium harness. Three 1.8-second scroll trials per build and width, 4× CPU slowdown, external fonts blocked in both builds. The visual inspection was a separate run with fonts loaded. Timing medians include one traced trial per group. Paint and layerization use that single trace and should not be treated as aggregate GPU measurements.

| Width | Median task time before → after | Median p95 frame interval | Trace paint count / time before → after | Trace layerization time |
|---|---:|---:|---:|---:|
| 390 px | 40.04 → 33.29 ms | 16.7 → 16.8 ms | 16 / 9.73 → 16 / 10.47 ms | 2.82 → 1.50 ms |
| 768 px | 26.70 → 26.64 ms | 16.7 → 16.8 ms | 9 / 9.25 → 9 / 7.67 ms | 3.46 → 2.33 ms |
| 1440 px | 27.69 → 21.96 ms | 16.7 → 16.7 ms | 6 / 5.76 → 5 / 3.64 ms | 1.61 → 1.54 ms |

No long tasks or layout shifts were observed in these samples. Mobile paint increased 0.74 ms in one trace without an increase in paint count or a material change in frame interval. The previous Phase 5D run showed the opposite direction at mobile. Treat this as run-to-run variation, not a speed improvement or a reproducible regression. CSS grew 1,480 B raw and 491 B gzipped. External JavaScript remains 8,792 B, and the Phase 5D comparison confirmed identical inline JavaScript. No Lighthouse or real-user scores were collected.

## Remaining issues and proposed corrections

| Severity | Finding | Targeted correction and evidence |
|---|---|---|
| Medium, inherited | With external fonts blocked, decorative header glyphs become literal strings such as ARROW_FORWARD. The navigation still functions, but the labels look unfinished and widen controls. | In Header.astro replace the arrow, menu, close and chevron ligatures with fixed-size, aria-hidden inline SVGs. Keep the toggle IDs, accessible button label and hidden states. A browser-only prototype removed visible ligatures at 320, 390, 768, 1280 and 1440 px, kept the page within the viewport, and preserved drawer open, Escape and focus restoration. Apply this as a separate source change and rerun navigation QA. Similar decorative glyphs elsewhere remain for a separate review. |
| Low, inherited | Booking border versus fill is close to 3:1. | If the border is used as the sole visual boundary, raise the shared booking option/button border from #5e5e69 to #63636e. The proposed color computes above 3:1 against #101012 and #141417. Preserve the existing selected state and outline. |
| Coverage gap | Engine and device limitations above. Spoken live announcements have not been heard in a screen reader. | Run the static fallback and normal-motion variants in Safari and Firefox, verify touch on physical Android, and use VoiceOver to confirm status and error announcements. Keep a persistent live region only if the speech test finds an announcement gap. |

The SVG proposal was verified in a local browser fixture only. No application source correction was folded into this QA pass.

## Test results and checkpoint readiness

| Check | Result | Exit |
|---|---|---:|
| Production build | Passed | 0 |
| Automated regression and unit/integration checks | 68 + 158 passed | 0 |
| Metadata, internal links and CSP | 151 passed | 0 |
| Full Chromium E2E | 122 suite checks + 3 cookie fixture checks passed | 0 |
| Security and function configuration | Passed | 0 |
| npm dependency audit | 0 reported vulnerabilities | 0 |
| Repeat baseline/after profiling | 18 scroll runs completed | 0 |
| Responsive, native timeline fallback and legal routes | Passed | 0 |
| Continuous booking → Starter package → contact | Passed at 390, 768 and 1440 px | 0 |
| Header SVG proposal | Passed in isolated fixture | 0 |
| SafariDriver | Automation setting blocked session | 2 |
| Git whitespace check | Passed | 0 |

Each continuous journey retained the booking state, focused the first invalid contact field, preserved Starter selection and accepted exactly one matching mocked receipt. No live enquiry was sent.

The isolated branch is phase5/premium-motion at a549cb7. The ten Phase 5D application files and this report are the intended checkpoint scope. The original phase5/premium-ui tree still holds the three protected QA artifacts at their recorded hashes, the untracked Phase 4 audit and the Phase 5C experiment. The production hero uses the static dial. No changes are staged. Review and approve the local checkpoint separately from any release.

Diagnostic logs, measurements, screenshots, browser traces and the SVG proposal fixture are in the ignored artifacts/phase5e directory of this worktree.

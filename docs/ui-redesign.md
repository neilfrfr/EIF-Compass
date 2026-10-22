# Fellowship Studio implementation and verification

Implemented October 21, 2026. The approved priorities are finding the next task, updating work, and submitting requirements. Whole-product redesign proceeds from intern workflows to lead tools and sign-in.

## Design references

- [Efferd App Shell 4](https://efferd.com/blocks/app-shell): inset workspace composition and grouped navigation.
- [Efferd Dashboard 3](https://efferd.com/blocks/dashboard): operational queues and team context.
- [Efferd Auth 2](https://efferd.com/blocks/auth): split brand/form composition.
- [Prompt Kit input with suggestions on 21st.dev](https://21st.dev/@ibelick/components/promt-input-with-actions/prompt-input-with-suggestions): visible composer and deliberate prompt selection.

These are pattern references. Application code is authored for the existing React architecture; no paid block or unverified registry installer was imported. Manrope is self-hosted with its included OFL license. No runtime dependency was added.

## Verification

- Frontend test suite passes, including new sign-in coverage and regression checks for account menu/sign-out, exact-record navigation, unsaved detail edits, focus restoration, retained filters, and concurrent lead review actions.
- Production build passes; the build reports a JavaScript chunk over 500 kB. Bundle splitting remains a separate optimization.
- Playwright MCP checked 1440×900, 1280×800, and 390×844 layouts using a browser-only isolated client fixture. Production authentication and database access were not changed. Fixture routes were removed after inspection.
- Verified desktop recommendation-to-record navigation, keyboard focus inside record detail, Escape closure, task status persistence in fixture, draft save, submission, lead review controls, and deliberately opened project editor.
- Verified phone navigation across all intern sections, assistant prompt filling and visible composer, full-screen submission detail, sign-in, and absence of page-wide horizontal overflow.
- Fresh source review found missing notification destinations and overlapping review busy tracking. Both were fixed and the reviewer confirmed those two findings resolved.

## Limits

Browser checks use controlled data, not live authenticated database writes, attachment storage, Google OAuth, or real assistant-provider calls. Existing tests cover their preserved application rules.

The root test command stops in the unchanged `backend/tests/migration-replay.test.cjs:12`: its regular expression assumes LF line endings while the checkout's operations SQL has CRLF. The initial run also encountered transient process memory exhaustion; a bounded-heap rerun exposed the deterministic parser failure. No backend files were changed to conceal or repair an unrelated failure.

Screenshots are local verification artifacts under `frontend/.test-output/studio-*.png` (ignored by Git). The Impeccable context launcher could not install its missing engine under the restricted cache path; project context and skill references were read directly.

## Interaction effects

Added selective hover lift, ambient shadows, readable glass menus/headers, a blurred drawer backdrop, buoyant overlay transitions, and six tiny pointer-click bubbles on primary actions and assistant starters. No idle loops, new dependency, or per-frame JavaScript handler. Bursts are throttled, capped, and cleaned up. Keyboard, reduced motion, forced colors, disabled and destructive actions suppress particles.

Playwright confirmed hover lift/shadow, six particles after pointer activation, cleanup after animation, and zero particles for keyboard/reduced-motion activation. Unit coverage includes throttle/cap, preference changes, forced colors, and disposal.

## Timing and palette refinement

Hover and overlay transitions now run for 300ms, with 60ms hover dwell and 100ms press response. Click bubbles last 620–710ms. Card and selected-tab shadows are more visible. The supplied swatch was sampled as RGB(36, 88, 98), #245862; this is now the deep brand color across navigation and sign-in, paired with #176f70 actions and mint surfaces.

## Navigation and hover spacing

Pointer navigation now slides in and out over 300ms. The dialog remains modal through exit; focus transfers only after closing. Cancellation supports rapid open/close. Keyboard and reduced-motion use immediate navigation. Shared 300ms control/row transitions with 60ms hover dwell apply across workspace pages and sign-in. Rows and title buttons have consistent highlight insets. Playwright verified entry/exit timing, retained modal state during exit, spacing and no horizontal overflow at 1040px.

## Deep Lagoon

Spec: `docs/superpowers/specs/2026-10-22-deep-lagoon-redesign-design.md`. Branch `feat/deep-lagoon-redesign`.

### What changed

- Semantic light and dark tokens in `src/styles/tokens.css` (brand colours unchanged), set on `html[data-theme]` by an inline no-flash script in `index.html`; the choice is stored in `localStorage['eif-theme']`, otherwise the OS preference wins. Theme toggle pill on sign-in and in the top bar; the theme change is the only circular View Transition reveal.
- Inter Variable self-hosted (`public/fonts`), weights 400/510/590, system monospace for IDs and key hints. Manrope removed.
- Global CSS split into `src/styles/*.css`. Hairline borders instead of drop shadows; status badges always pair an icon with a text label.
- Motion: page arrival stagger and count-ups, lift-and-blur page switch, sliding sidebar pill and hover pill, row hover glide, task completion check and strike, command palette (Ctrl/Cmd K) and `G` then `O/W/R/C` shortcuts, aurora, animated compass logo, restyled drawer, menu and toast motion. Everything collapses to instant under `prefers-reduced-motion`.
- Next Best Action card with a cursor spotlight and an inline streamed "Explain this" that saves to the same assistant history (interns only).
- Sign-in: masked headline rise, mint sheen on "clear direction.", a journey line that draws itself and then follows the cursor on fine pointers, a shake on failed sign-in and an arrival overlay that never delays `children(session)`.
- Dev-only `?fixture=intern|lead` in-memory client for visual checks; it is tree-shaken from production builds.

### Verification

- `npm test` (19 suites) and `npm run build` pass. Build output: `index.html` 1.10 kB, CSS 85.62 kB (17.09 kB gzip), JS 574.98 kB (160.76 kB gzip). Vite still warns about the single chunk over 500 kB. `dist` does not contain fixture data (`Fellowship Resource Hub` absent).
- Interaction behaviour (theme storage and junk values, shortcut guards while typing or with a dialog open, palette focus trap, explanation abort on navigation or account change, reduced-motion count-ups, completion flash) is covered by the JSDOM tests in `frontend/tests`, not by browser automation.
- Visual checks: the Playwright MCP was unavailable for the whole build, so verification used headless Chrome (`--headless=new`) driven over the DevTools protocol by a throwaway Node script (not committed). It captured every intern and lead page in light and dark at 1440x900, 1280x800 and 390x844 (108 screenshots), plus sign-in, the intro animation, cursor-following journey, command palette, detail drawer (intern and lead), the inline explanation streaming and saved, a mid-page-switch frame and the reduced-motion first frame. Screenshots are in `frontend/.test-output/lagoon-*.png` (ignored by Git).
- Measured results: no page-wide horizontal overflow at 390px (`scrollWidth <= innerWidth` on every page; the lead progress table scrolls inside its own panel). Every visible status badge has an icon and text. `--muted` contrast is 5.56:1 on `--surface` and 5.02:1 on `--canvas` in light, 6.80:1 and 7.53:1 in dark. With `eif-theme=dark` stored and the OS in light mode, the first animation frame already has `data-theme=dark` and the dark `theme-color`. A page switch never calls `startViewTransition` and shows no clip-path; the theme toggle calls it once. With reduced motion emulated the metric strip shows final values 250ms after load (normal motion shows 0 at that point). The palette filters, opens a page with Enter and moves focus to its heading; `G` `W` navigates. The sign-in theme toggle is 30px tall but its coarse-pointer hit area is 46px.
- Fixed from these checks: the Next Best Action buttons stretched to 94px at 767px and below, and an opened explanation wrapped into an off-screen second column at that width; the fixture showed every notification twice (no RLS stand-in); dead `.studio-login-checking p` selectors were removed.

### Limits

Visual checks used headless Chrome with emulated touch and media features, not real phones, Safari or Firefox, and fixture data rather than live Supabase, Storage, Google OAuth or the real assistant provider. Hover effects were driven by synthetic pointer events. The session-checking screen is too brief with the fixture to capture and was not viewed. The sidebar selected pill slides in from the top of the nav once on first load; this is left as is. The JavaScript bundle is still a single chunk over 500 kB.

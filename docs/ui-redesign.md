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

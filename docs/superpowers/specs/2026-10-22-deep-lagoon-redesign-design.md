# EIF Compass — Deep Lagoon Frontend Redesign Design
Date: October 22, 2026
Status: Proposed design for review; no implementation yet.
Baseline: dev at 78cb259 (`feat(ui): redesign fellowship workspace`).
Approved prototypes (throwaway, not to be shipped as code): `.superpowers/brainstorm/781-1792599813/content/motion-prototype.html` and `login-prototype.html`.

`overview-direction.html` in the same folder was only used to choose between colour directions; the user picked B. The current Overview layout already has a four-metric strip and two columns, and it stays as it is.

## 1. Intent
EIF interns open Compass every day, mostly to Overview, My work, Requirements and Calendar. The redesign should make the product feel so smooth and well crafted that people want to stay in it. The "jaw-dropping" quality comes from beautiful effects and fluid motion, not from new features.

The visual language borrows Linear's precision (from the supplied DESIGN.md, tokens.json, variables.css and theme.css), but keeps EIF's teal and mint brand. The app must not look black-and-white. It gains a light/dark theme toggle.

The PRD's usability goal still leads: an intern names their next priority within about 30 seconds of opening Overview. The Next Best Action card is the focal point of the product.

## 2. Goals, non-goals, anti-goals
**Goals**
- Restyle every screen, for both roles: sign-in, app shell, Overview, My work, Requirements, Calendar, Projects, Feedback, Blockers, Notifications and the AI assistant. Daily-work screens get the most polish.
- Light and dark themes, plus a toggle.
- The motion set in section 6, smooth on an ordinary laptop.
- Inter as the UI typeface.

**Non-goals**
- No change to how screens are laid out (beyond the restyle), to data, permissions, Supabase queries, the assistant API or business rules. The one approved behaviour change is the inline explanation in section 6a.
- No new data actions. For example, no inline "complete task" checkbox on Overview; see section 6.
- No new routes or router. Navigation stays in React state.

**Anti-goals: things that would make this a failure even if it "works"**
- It looks like stock Linear: black, white and acid-lime.
- Motion makes the app feel slower, blocks interaction or delays first paint. The dashboard must still load in under 3 s.
- Status shown by colour alone, weak contrast in either theme, or broken keyboard use.
- Any test in `frontend/tests` regresses.

## 3. Constraints
- Stack: React 19, Vite 8, TypeScript, Tailwind v4 (installed) and plain CSS files. **Add no runtime dependencies.** No animation library: use CSS, the Web Animations API and the View Transitions API where supported.
- Tests transpile source files and strip CSS imports by **exact string** (`import './assistant.css';`, `import './auth.css';`). Keep those import lines unchanged. Put new global CSS in `main.tsx` imports. Keep existing accessible names, roles and visible texts that tests assert, such as "Welcome back", the "Show password"/"Hide password" labels with `aria-pressed`, `role="alert"` errors, and "Invalid login credentials" passthrough.
- `prefers-reduced-motion: reduce` disables all non-essential motion. `forced-colors` must remain usable.
- PRD accessibility: keyboard navigation, readable contrast (WCAG AA for text in both themes), and no status by colour alone.
- Streaming assistant replies must still look visibly incomplete until complete (PRD AI rule).

## 4. Visual system: "B · Deep Lagoon"
### Typography
- Inter Variable, **self-hosted** woff2 in `frontend/public/fonts` with its OFL licence, and preloaded in `index.html` (replacing the Manrope preload). Use `font-feature-settings: "cv01","ss03","zero"`. Remove Manrope once nothing uses it.
- Weights 400 / 510 / 590 only. No 700+.
- Tight tracking on headings: about -0.022em at display sizes and -0.012em at 20–32px. Body text 13–14px at -0.011em.
- Monospace (system `ui-monospace, "Cascadia Code", Consolas, monospace`) only for record IDs such as `TASK-14` and keyboard hints.

### Colour tokens
Semantic CSS variables are set on `html[data-theme=light|dark]`. Component CSS uses only the semantic variables.

| Token | Light | Dark |
|---|---|---|
| canvas | #eef5f2 | #081b1d |
| surface (cards) | #ffffff | #0d2528 |
| surface-2 | #e6f0ec | #112d31 |
| line (hairline) | #d5e3df | #1a3a3e |
| ink (body) | #203f43 | #cfe3de |
| strong (headings) | #12333a | #effaf6 |
| muted | #526d70 | #8db0aa |
| accent (primary action fill) | #176f70 | #deeee7 |
| on-accent | #ffffff | #14353a |
| accent-text (links, chips) | #176f70 | #a8dccb |
| chip / selected bg | #deeee7 | #143b3a |
| glow | #2a9d9633 | #3fb8a92e |
| sidebar bg | #245862 | #061416 |
| sidebar text / muted | #ffffff / #c1dbd6 | #effaf6 / #8db0aa |
| sidebar selected bg / text | #deeee7 / #174f56 | #143b3a / #deeee7 |
| danger text / bg | #a23a2a / #fbeae5 | #ff9180 / #3a1611 |
| warning text / bg | #8a4d16 / #faf0dc | #f2b46a / #33230f |

Brand colours stay exactly as they are: `#245862`, `#176f70`, `#203f43` and `#deeee7`. Dark mode is deep teal-green, never neutral grey or black.

### Shape and elevation
- Corner radii: 6–7px for buttons and inputs, 12px for cards and panels, round for pills and toggles, and 4–5px for badges. The rounded inset main area (about 14px) inside the sidebar frame is kept.
- Use hairline borders (1px inset box-shadow in `line`) instead of drop shadows. The only real shadows are on the primary button glow, toasts, the command palette and menus.
- Compact spacing on a 4px base.

### Key components
- **Next Best Action card:** mint-tinted fill, a hairline border that lights up near the cursor, a soft glow, a "✦ Suggested next step" chip (keeps the suggestion label), the title, the due date and the reason, a primary "Open" action and a ghost "Explain this" action. Records have no short IDs, only UUIDs, so the prototype's `TASK-14` chip is left out and no display IDs are invented.
- **Status badges** (Overdue, Pending, Upcoming, Under review, Completed, plus the task statuses) always pair an icon with text. Colour adds meaning but never carries it alone.
- **Metric row:** a single hairline-bordered strip with tabular numerals.
- **Top bar:** sticky, with a translucent blurred background, a breadcrumb, a "Search or jump to… Ctrl K" trigger and the theme toggle pill (sun/moon with a sliding thumb).
- **Sidebar:** keeps the existing groups and labels from `App.tsx`, the cohort identity block and the account menu. Keyboard hints appear next to the daily-work items.
- **Logo:** the existing `/compass-mark.svg` artwork, with the "eif compass" wordmark and the "Innovation Fellowship" subtitle. Inline it where it needs to animate.

## 5. Theme behaviour
- First visit follows `prefers-color-scheme`. A choice made with the toggle is saved in `localStorage` and wins from then on.
- A tiny inline script in `index.html` sets `data-theme` before first paint, so the wrong theme never flashes. `<meta name="theme-color">` and `color-scheme` follow the theme.
- The toggle is a real button with an accessible name and pressed state, and works from the keyboard. It is available on the sign-in page and in the app top bar, and from the command palette.

## 6. Motion
All motion uses `cubic-bezier(.23,1,.32,1)` (ease-out) for entering elements and `cubic-bezier(.77,0,.175,1)` for larger moves. Only transform, opacity, filter and clip-path are animated, except the items noted below. Everything respects reduced motion.

| # | Moment | Behaviour |
|---|---|---|
| 1 | Page arrival | Sections rise about 10px from a 6px blur with a 70ms stagger, roughly 0.7s. Numbers count up with an ease-out. Progress bars fill. Runs on each page show, not on every data refresh. |
| 2 | Page switch | Old content lifts about 6px and blurs away in about 160ms, the main area scrolls to top, then the new page arrives as in #1. **Never** the circular reveal. Focus still moves to the page heading as today. |
| 3 | Sidebar | The selected highlight is one pill that slides between items. A separate faint hover pill follows the pointer. Mobile navigation keeps its dialog and behaviour. |
| 4 | Theme switch | View Transition circular reveal from the toggle. Used **only** for the theme. Falls back to an instant switch. |
| 5 | Next Best Action | A cursor-tracking spotlight on the border and background (pointer devices only). The suggestion chip's sparkle twinkles slowly. |
| 6 | Explain / AI streaming | **"Explain this" streams inside the Next Best Action card (user decision).** See section 6a. The explanation area expands smoothly. Streamed text shows a blinking caret and a "Generating…" label until it is complete, which satisfies the PRD rule that partial answers look incomplete. The same caret and label treatment applies to streaming on the Assistant page. |
| 7 | Lists | A shared hover highlight glides between rows. Row hover never shifts layout. |
| 8 | Completing work | When a task's status changes to Completed in My work's existing status select, a check draws on the row and a strike-through sweeps across its title. The row stays visible until the roughly 600ms animation ends, even if a filter would hide it. The existing "Task status saved." toast confirms the change. There is no Undo button, because reverting is done through the same select. No inline checkboxes are added to Overview. |
| 9 | Command palette (Ctrl/⌘ K) | Scale and blur in over a dimmed backdrop. Type to filter, use arrow keys and Enter, or click. Commands: go to any page in the current role's nav, toggle theme, report a blocker (go to Blockers), ask the assistant (go to Assistant). A focus trap and Escape both close it and return focus. |
| 10 | Shortcuts | `G` then `O/W/R/C` jumps to Overview, My work, Requirements or Calendar. Ignored while typing in inputs, textareas or selects, or while a dialog is open. |
| 11 | Ambient | A slow-drifting teal aurora behind the top of the main area and the sign-in story panel. CSS-only, paused under reduced motion. |
| 12 | Buttons and fields | Press scale 0.97–0.98, arrow nudge on hover, focus glow ring on inputs, and a gentle shake plus slide-in error on a failed sign-in. |
| 13 | Logo | The compass arc draws and the needle swings, overshoots and settles on load. It swings again on hover. |
| 14 | Drawers and menus | The existing detail drawer, account menu and toast keep their behaviour with restyled motion. |

### 6a. Inline "Explain this"
This is the one behaviour change. The user chose it. The explanation must still be saved to the same private assistant history, so the demo step "show the saved explanation in AI assistant" keeps working.
- **Reuse, don't duplicate.** Use the existing `historyRequest` helper and the existing endpoints. First `GET /api/assistant/history` to get the conversation (id, generation, revision). Then `POST /api/assistant` with the same body the Assistant sends today for an explanation: the question text built in `App.tsx`, `intent:'explain_next_action'`, `expectedAction {id, view}`, `stream:true`, a new `requestId`, plus the conversation's id, generation and revision. **No change to the API or the prompt.**
- **Streaming:** deltas appear in the card as they arrive, with a caret and "Generating…" label.
- **Saved:** if `historySaved` is true, show the answer, a quiet "Saved to your assistant history" note and a "Continue in assistant" link (navigate to Assistant).
- **Not saved:** if the answer completes but isn't saved, keep the answer and show a "Retry saving" button. It calls `POST /api/assistant/history` with the same payload the Assistant's `retrySave` uses, without a new AI request.
- **Interrupted or failed:** keep any partial text, labelled "Incomplete — not saved", with the error, plus an "Open in assistant" action that falls back to today's behaviour (navigate to Assistant with the explanation request).
- **Always visible:** the rule-based reason and due date stay on the card the whole time, which preserves the PRD fallback.
- **Guards:** only one explanation request at a time. Abort it if the user navigates away, the action changes, or the account or cohort changes. Late responses from a stale request are ignored.
- **Lead role:** leads have no Next Best Action card, so this applies to interns only.

The existing pointer-click bubbles in `interaction-effects.ts` are kept, recoloured to the theme. They already respect reduced motion, keyboard input, forced colours and destructive actions.

## 7. Sign-in page
Keep the current structure and wording of `AuthGate.tsx`: the story panel ("Your next chapter / starts with a / clear direction.", the subtitle, the three-step journey line with "Find your focus · Build together · Move forward") and the form ("Welcome back.", the email and password fields with Show/Hide, the "Need access or help signing in? Contact your fellowship lead." help text and the footer).

New motion:
- The logo settles.
- The headline lines rise in from a mask, and "clear direction." has a slow mint sheen.
- The journey path draws itself while a light travels along it, and each node pops in as the light reaches it. The last node pulses.
- **The journey line follows the cursor (user request).** Once the intro finishes, moving the pointer over the story panel makes the line respond:
  - The two bend points and the end nodes ease toward the cursor, up to about 28px of offset, nearer points moving more. The motion is smoothed with a damped lerp in one `requestAnimationFrame` loop that stops when settled.
  - The two faint parallel lines follow with less movement, which gives a parallax feel.
  - The travelling light glides to the point on the line nearest the cursor's horizontal position.
  - When the pointer leaves, everything springs back to rest.
  - This happens only on fine-pointer devices, and not under reduced motion. Paths are updated by setting the SVG `d` attribute, with no layout reads inside the loop.
- Aurora and a faint grid sit in the story panel, with a glow behind the form.
- Fields get the focus ring, a failed sign-in shakes and shows the error, and the button shimmers while busy.

After a successful sign-in, a decorative overlay opens in a circle from the Sign in button, showing the compass and "Opening your workspace…" (with "Good morning, {name}" only once the profile is known). The overlay is an enhancement: the workspace (`children(session)`) must render immediately, exactly as now (tests assert this). The overlay sits on top and removes itself.

The session-checking state ("Opening your workspace…") and the workspace loading/unavailable state get the same visual treatment. The theme toggle sits in the top-right corner. The mobile layout keeps a single column.

## 8. Responsiveness
Desktop first, with the existing breakpoints (1199, 900 and 767px) preserved. On mobile, the PRD priorities (Next Action, Tasks, Deadlines, Notifications) stay first. Cursor-tracking and hover effects apply only on fine-pointer, hover-capable devices. Touch targets are at least 44px on mobile.

## 9. Verification
- `npm test` and `npm run build` in `frontend` pass.
- Playwright screenshots in both themes at 1440×900, 1280×800 and 390×844 of sign-in, every intern page and every lead page, using the browser-only fixture approach from `docs/ui-redesign.md`, with no live data writes.
- Manual checks:
  - Reduced motion shows no animation.
  - The keyboard alone can reach the theme toggle, palette and shortcuts.
  - Text contrast is AA in both themes.
  - There's no horizontal overflow at 390px.
  - There's no theme flash on reload.
  - The page switch never uses the circular reveal.

## 10. Decided by the user
- Direction B "Deep Lagoon", in both light and dark, with brand colours unchanged.
- Inter replaces Manrope.
- Every screen and both roles get the new look, with the daily-work screens as the focus.
- The motion set as shown in the prototype, with these changes: page switches use the lift-away/rise-in transition instead of the circle reveal, the original compass logo is used, and the command palette works with typing, Enter and click.
- The sign-in page as shown in the login prototype, plus a journey line that follows the cursor.
- "Explain this" streams inside the Next Best Action card (section 6a).
- **Lead pages get the same level of polish as intern pages:**
  - Lead Overview (cohort metrics, team progress table with drill-down, review queue, overdue and blocker lists).
  - Cohort tasks, requirement review, the event manager, Projects, Feedback, Blockers, Notifications and the lead Assistant.
  - Each gets the full motion set where it applies: arrival, count-up, list glide, completion and review-state transitions, and the drawer.
  - The verification screenshots cover every lead page in both themes.
- Commit and push to the GitHub repository when done.

## 11. Builder's calls (made by Claude; may be revisited)
- Theme defaults to the operating system preference and is remembered per browser.
- Inter is self-hosted rather than loaded from Google Fonts, to protect performance and privacy. System monospace is used instead of a second web font.
- No inline task checkbox on Overview (it would be a new data action). The completion motion plays in My work's existing status flow.
- The click bubbles are kept and recoloured.
- The real sidebar group names and nav items are kept (the prototype used placeholder groups).
- No `TASK-14` style IDs, and no Undo on task completion (see sections 4 and 6).
- The "Good morning, {name}" splash text waits for the profile and falls back to "Opening your workspace…".

# Deep Lagoon Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle EIF Compass to the "Deep Lagoon" system: Linear-precise, teal/mint brand, light and dark themes, a full motion set, inline "Explain this" and an animated sign-in. Intern and lead pages get equal polish.

**Architecture:**
- **CSS:** the three overlapping minified stylesheets (`styles.css`, `brand.css`, `interaction-effects.css`) are replaced by token-driven files under `src/styles/`. Colours live only in `src/styles/tokens.css`, as semantic CSS variables keyed on `html[data-theme]`.
- **Motion:** CSS plus the Web Animations and View Transitions APIs, with small typed helpers in `src/motion.ts`.
- **Structure:** React component structure, data flow and Supabase queries are unchanged. The only behaviour change is the inline explanation (`ExplainInline.tsx`).

**Tech Stack:** React 19, TypeScript 6, Vite 8, plain CSS (Tailwind v4 stays installed, but `@import "tailwindcss"` is kept only if something uses its utilities), and Node test scripts with JSDOM (`frontend/tests/*.test.mjs`, run by `npm test`).

**Spec:** `docs/superpowers/specs/2026-10-22-deep-lagoon-redesign-design.md`. Read it first; its token table, motion table (section 6), inline-explain rules (6a) and sign-in rules (7) are normative. Visual reference for both themes: `.superpowers/brainstorm/781-1792599813/content/motion-prototype.html` and `login-prototype.html`. Open them in a browser; they are throwaway and must not be copied wholesale.

## Global Constraints
- **No new runtime dependencies.** No animation libraries. Downloading the Inter font file is fine.
- **Colours:** hex/rgb colours may appear only in `src/styles/tokens.css`, `public/compass-mark.svg` and inline logo SVG markup. Everything else uses `var(--…)`. Brand colours stay exactly `#245862`, `#176f70`, `#203f43` and `#deeee7`.
- **Font:** Inter, self-hosted at `public/fonts/InterVariable.woff2` with `public/fonts/Inter-LICENSE.txt` (OFL). Use `font-feature-settings:"cv01","ss03","zero"` and weights 400/510/590 only. Monospace is `ui-monospace,"Cascadia Code",Consolas,monospace`.
- **Easing:** `--ease-out: cubic-bezier(.23,1,.32,1)` and `--ease-in-out: cubic-bezier(.77,0,.175,1)`. Animate only transform, opacity, filter and clip-path, except the progress-bar width and SVG `d` (sign-in journey).
- **Reduced motion and forced colours:** `prefers-reduced-motion: reduce` makes every motion instant (count-ups show the final value, no aurora, no stagger, no reveal). `forced-colors: active` stays usable.
- **The circular clip-path reveal is for theme changes only.** Page switches never use it.
- **Status is never shown by colour alone.** Every status badge has an icon and a text label.
- **Test compatibility:** keep these exact import lines, because tests strip them by string: `import './assistant.css';` in `Assistant.tsx` and `import './auth.css';` in `AuthGate.tsx`. Keep accessible names and texts the tests assert ("Welcome back", Show/Hide password `aria-label` + `aria-pressed`, `role="alert"` errors). `children(session)` must render immediately after sign-in.
- **Breakpoints:** keep 1199px, 900px and 767px. Mobile touch targets are at least 44px. Pointer/hover effects apply only under `(hover:hover) and (pointer:fine)`.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** git commands must be run from PowerShell. The Bash sandbox cannot write `.git`.

## Review Focus
1. **`localStorage` unavailable or holding junk** (private mode, a value like `"blue"`): the theme falls back to the OS preference, with no crash and no flash. Tested in Task 2.
2. **Shortcuts while typing:** `G` then `W` typed into an input, textarea, select or contenteditable, or pressed with Ctrl/Alt/Meta, or while a dialog is open, must not navigate. Tested in Task 6.
3. **Leaving mid-explanation:** navigating away or changing account during an inline explanation aborts it. No late text appears, and the request is not left in flight. Tested in Task 7.
4. **Reduced motion:** count-ups render final numbers on first paint and page switches are instant. Tested in Tasks 5 and 7.
5. **Very long titles and names** (an 80-character task title, a 40-character display name) don't overflow the Next Best Action card, sidebar, palette or lists at 390px in either theme. Fixture data includes them (Task 1) and Task 12 checks them visually.

---

### Task 1: Dev-only fixture harness for visual verification

**Why:** every later task needs to see real screens in both roles without Supabase. This harness exists only in dev; production builds must not contain it.

**Files:**
- Create: `frontend/src/dev/fixture.ts`
- Modify: `frontend/src/lib/supabase.ts`
- Test: `frontend/tests/fixture.test.mjs` (add to the `test` script in `package.json`)

**Interfaces:**
- Produces: `createFixtureClient(role:'intern'|'lead'): SupabaseClient`, an in-memory stand-in implementing what the app calls:
  - `auth.getSession`, `auth.onAuthStateChange`, `auth.signInWithPassword`, `auth.signOut`
  - `from(table)` with chainable `select/eq/neq/in/is/order/limit/maybeSingle/single`, plus `insert/update/delete/upsert` that mutate the in-memory rows. The result is thenable as `{data,error}`.
  - `storage.from().createSignedUrl/upload/remove`, returning success.
- Produces: `installFixtureFetch(): void`, which patches `window.fetch` for `/api/assistant/history` (GET returns `{conversation:{id:'conv',generation:1,revision:0},turns:[],has_more:false,next_before:null}`; POST and DELETE succeed) and `/api/assistant` (an NDJSON stream of about 30 `delta` events 40ms apart, then `complete` with `historySaved:true`, a `turn` and a `conversation`). Other `/api/*` calls return `{}`.
- Activation in `lib/supabase.ts`: if `import.meta.env.DEV` and the URL has `?fixture=intern|lead`, export the fixture client and call `installFixtureFetch()`. Otherwise keep the current behaviour. Use a dynamic `import()` behind the `DEV` check so production tree-shakes the fixture.
- **Seed data:** mirror the demo cohort in the PRD (`EIF Compass PRD v2`, "Demo rehearsal").
  - People: intern "Ana Reyes" (id `a`), a second intern, and a lead.
  - Project and sprint: team "Lagoon", project "DEMO · Fellowship Resource Hub", sprint "Prototype Sprint", and milestone "Clickable prototype".
  - Tasks: "DEMO · Finalize prototype navigation" (to_do, due tomorrow), one completed task, and one task with an 80-character title.
  - Requirements: 4 total, covering overdue, pending within 24h, upcoming and completed.
  - Other records: 2 events in the future, 1 open blocker "Design asset access" with a lead comment, 2 feedback records and 3 notifications.
  - Also add one profile with a 40-character display name.

- [ ] **Step 1: Write the failing test.** Import the transpiled `fixture.ts`, same pattern as `tests/dashboard-ui.test.mjs`. Assert:
  - `(await client.from('tasks').select('*').eq('assignee_id','a')).data.length >= 2`
  - after `update({status:'completed'}).eq('id',<taskId>)` the row reads back as completed
  - `(await client.auth.getSession()).data.session.user.id === 'a'` for `intern`, and the lead id for `lead`
- [ ] **Step 2:** Run `node tests/fixture.test.mjs`. Expect it to fail because the module is missing.
- [ ] **Step 3:** Implement `fixture.ts` and the activation in `lib/supabase.ts`.
- [ ] **Step 4:** `node tests/fixture.test.mjs` passes. `npm run build` passes, and `dist` contains no `Fellowship Resource Hub` (check with `grep -r "Fellowship Resource Hub" dist`, which should return nothing). Then run `npm run dev` and open `/?fixture=intern` and `/?fixture=lead`. Both workspaces load with data, and the Assistant page streams.
- [ ] **Step 5:** Commit `chore(dev): add fixture harness for visual verification`.

### Task 2: Theme foundation (tokens, Inter, persistence, toggle)

**Files:**
- Create: `frontend/src/styles/tokens.css`, `frontend/src/theme.ts`, `frontend/src/ThemeToggle.tsx`, `frontend/public/fonts/InterVariable.woff2`, `frontend/public/fonts/Inter-LICENSE.txt`
- Modify: `frontend/index.html` (Inter preload replaces Manrope, inline no-flash script, `theme-color` meta), `frontend/src/main.tsx` (import `./styles/tokens.css` first)
- Test: `frontend/tests/theme.test.mjs`

**Interfaces:**
- Produces from `theme.ts`:
  - `type Theme='light'|'dark'`
  - `readTheme(): Theme`: a stored value if valid, else `matchMedia('(prefers-color-scheme: dark)')`, else `'light'`. Any storage exception means "not stored".
  - `applyTheme(t:Theme): void`: sets `document.documentElement.dataset.theme`, `style.colorScheme` and the `meta[name=theme-color]` content (light `#245862`, dark `#061416`).
  - `setTheme(t:Theme, origin?:{x:number;y:number}): void`: persists to `localStorage['eif-theme']` (swallowing errors), then applies the theme. When `origin` is set, `document.startViewTransition` exists and motion isn't reduced, it wraps the change in a view transition with `html.vt-theme` and the variables `--tx/--ty/--tr`, then removes the class when it finishes.
  - `toggleTheme(origin?)`.
- Produces: `<ThemeToggle/>`, a `button` with `aria-label="Dark mode"` and `aria-pressed={theme==='dark'}`. It shows the sun/moon pill with a sliding thumb (as in the prototype), passes its centre as `origin`, and listens to `storage` events so tabs stay in sync.
- **`tokens.css` contents:**
  - every token in spec section 4, under `html[data-theme=light]` (also the `:root` default) and `html[data-theme=dark]`
  - the status colour pairs, `--ease-out`, `--ease-in-out`, the radius tokens (`--r-btn:7px; --r-card:12px; --r-badge:5px`)
  - `@font-face` for Inter
  - the `.vt-theme::view-transition-*` reveal rules (the `.vt-theme`-scoped CSS from `motion-prototype.html`)
  - the global reduced-motion rule
- **No-flash script in `<head>`:** about 4 lines that run `readTheme` logic inline (same key and fallback) and set `data-theme` before CSS loads.

- [ ] **Step 1: Write the failing tests** (JSDOM, stub `matchMedia`):
  - `readTheme()` returns `'dark'` when storage is empty and the OS prefers dark.
  - It returns `'light'` when storage holds `'blue'`.
  - It returns `'dark'` when `localStorage.getItem` throws and the OS prefers dark.
  - `setTheme('dark')` sets `dataset.theme==='dark'` and stores `'dark'`.
  - Rendering `ThemeToggle` and clicking it flips `aria-pressed` and `dataset.theme`.
  - A static check reads `index.html` and asserts it contains `eif-theme` and no `manrope`.
- [ ] **Step 2:** Run `node tests/theme.test.mjs`. Expect it to fail.
- [ ] **Step 3:** Implement. Download Inter Variable woff2 (rsms/inter release `InterVariable.woff2`) and its OFL licence.
- [ ] **Step 4:** The theme test and `npm test` pass, and `npm run build` passes.
- [ ] **Step 5:** Commit `feat(theme): add Deep Lagoon tokens, Inter and theme persistence`.

### Task 3: Rebuild base, shell, overview and sign-in styles on tokens

**Files:**
- Create: `frontend/src/styles/base.css` (reset, typography, buttons, inputs, badges, panels, focus rings, scrollbars, selection), `frontend/src/styles/shell.css` (sidebar, mobile navigation dialog, main area, top bar, page heading, footer, toast, account menu), `frontend/src/styles/overview.css` (all `.dashboard-*`, `.role-dashboard`, `.lead-dashboard`, `.fellowship-journey`, `progress`, the metrics strip, team table)
- Rewrite: `frontend/src/auth.css` (static sign-in layout on tokens; motion arrives in Task 11)
- Modify: `frontend/src/main.tsx` import order: `tokens.css`, `base.css`, `shell.css`, `overview.css`, then the remaining old files
- Remove from `styles.css` and `brand.css` every rule whose selectors are now owned by the new files. Rules for unrelated selectors stay until Task 4.
- Test: `frontend/tests/theme-tokens.test.mjs` (add to `npm test`)

**Interfaces:**
- Consumes: the variables from `tokens.css` (Task 2).
- Produces: the class names used in `App.tsx`, `Dashboard.tsx` and `AuthGate.tsx`, unchanged. Also the shared primitives later tasks use:
  - `.btn-primary`: alias the existing `.primary-button` look, so keep both selectors
  - `.text-button`
  - `.status-badge` with modifiers `.is-overdue/.is-pending/.is-upcoming/.is-review/.is-completed/.is-todo/.is-progress`
  - `.card` (an alias of `.panel`/`.dashboard-panel`)

Get the look from the spec's section 4 and the prototype. Write CSS readably, one rule per line block (not minified).

`base.css` also owns:
- the button press scale (`:active` scale .97, not when disabled or focus-visible)
- the primary-button arrow nudge on hover (`svg` translateX 3px)
- the input focus glow ring

`shell.css` also styles the workspace loading and unavailable state (`.login-page.login-checking` and `.login-card` in `App.tsx`) and the session-checking state (`.studio-login-checking` in `AuthGate.tsx`), using the sign-in look.

- [ ] **Step 1: Write the failing test.** `theme-tokens.test.mjs` reads every `.css` under `src/` except `styles/tokens.css`, plus the not-yet-migrated `styles.css`, `brand.css` and `interaction-effects.css` (temporarily allowlisted, with a comment saying Task 4 removes them). It asserts no match for `/#[0-9a-fA-F]{3,8}\b|rgba?\(/`. It also asserts `tokens.css` defines `--canvas` under both `[data-theme=light]` and `[data-theme=dark]`.
- [ ] **Step 2:** Run it. Expect it to fail on `auth.css`.
- [ ] **Step 3:** Write the new files, rewrite `auth.css` and prune the migrated rules from the old files.
- [ ] **Step 4:** `npm test` and `npm run build` pass. With `npm run dev`, open `/?fixture=intern` and `/?fixture=lead` and toggle `dataset.theme` in DevTools. The shell, Overview and sign-in (sign out from the fixture) match the prototype colours in both themes, with no light-coloured leftovers in dark mode on those screens.
- [ ] **Step 5:** Commit `feat(ui): rebuild shell, overview and sign-in styles on theme tokens`.

### Task 4: Rebuild remaining page styles; retire old stylesheets

**Files:**
- Create: `frontend/src/styles/work.css` (`WorkManager` lists, filters, record forms, `.remove-confirmation`, `SubmissionBin`, `DetailDrawer`), `frontend/src/styles/flows.css` (`InternFlows`: projects, feedback, blockers, notifications, flow tabs and cards), `frontend/src/styles/calendar.css` (`Agenda`, `GoogleCalendar`), `frontend/src/styles/effects.css` (the click-bubble and hover rules from `interaction-effects.css`, recoloured with tokens)
- Rewrite: `frontend/src/assistant.css` on tokens
- Delete: `frontend/src/styles.css`, `frontend/src/brand.css`, `frontend/src/interaction-effects.css`. Update the `main.tsx` imports. `@import "tailwindcss"` goes in `base.css` only if `grep -rE 'className="[^"]*\b(flex|grid|p-|m-|text-|bg-)' src` finds Tailwind utilities in use; otherwise drop it.
- Modify: `frontend/tests/theme-tokens.test.mjs`, removing the temporary allowlist.

**Interfaces:**
- Consumes: the shared primitives from Task 3.
- Produces: the class names used by `WorkManager.tsx`, `SubmissionBin.tsx`, `DetailDrawer.tsx`, `InternFlows.tsx`, `Agenda.tsx`, `GoogleCalendar.tsx` and `Assistant.tsx`, unchanged.

- [ ] **Step 1:** Remove the allowlist from `theme-tokens.test.mjs`. Run it, and expect it to fail.
- [ ] **Step 2:** Write the new files, rewrite `assistant.css`, delete the old files and fix the imports. Before deleting, run `grep -oE 'className=("[^"]+"|\{`[^`]+`\})' src/*.tsx` and confirm every class used is styled in the new files, so nothing is silently unstyled.
- [ ] **Step 3:** `npm test` and `npm run build` pass. Visually check every intern and lead page in both themes using the fixture, including the open detail drawer, a remove confirmation, the submission bin and Google Calendar sync. There must be no un-themed surfaces.
- [ ] **Step 4:** Commit `feat(ui): move all pages to theme tokens and retire legacy stylesheets`.

### Task 5: Shell motion (nav pill, page transitions, logo, aurora, top bar)

**Files:**
- Create: `frontend/src/motion.ts`, `frontend/src/CompassLogo.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/styles/shell.css`
- Test: `frontend/tests/motion.test.mjs`

**Interfaces:**
- Produces from `motion.ts`:
  - `reducedMotion(): boolean`
  - `useCountUp(target:number|null, opts?:{delay?:number;duration?:number}): number|null`. This is an ease-out quartic over 1100ms by default. It returns `target` immediately under reduced motion or when `target` is null. It animates only when `target` changes; re-renders with the same value don't restart it.
  - `useSlidingIndicator(container:RefObject<HTMLElement>, activeSelector:string): void`. It positions a single `.nav-pill` element by `translateY(offsetTop)` for the active item and a `.nav-hover-pill` for the hovered item. It recomputes on active change and resize, and leaves `transform` to the CSS transition.
  - `usePageTransition(key:string): {className:string}`. On key change it returns `'page-leaving'` for 160ms and then `'page-entering'`. It is instant under reduced motion.
- Produces: `<CompassLogo size={32} animate/>`, the inline version of `public/compass-mark.svg` (same paths and colours) with `.arc` and `.needle` classes. The draw and settle keyframes run on mount, and the needle swings again on hover (prototype values).
- **App.tsx changes:**
  - The sidebar uses `CompassLogo` and gains the two pills inside `nav.side-nav`. Daily-work items show `<kbd>G O</kbd>`-style hints (`aria-hidden`).
  - The top bar gets the "Search or jump to… Ctrl K" trigger (a `button` that dispatches `window.dispatchEvent(new Event('eif:palette'))`) and `<ThemeToggle/>`.
  - `.page-wrap` gets the `usePageTransition(view)` class. Sections inside pages get the stagger through CSS (`.page-entering > * { animation: rise .7s var(--ease-out) both; animation-delay: calc(var(--i) * 70ms + 80ms) }`, setting `--i` by `:nth-child` up to 6).
  - The main area scrolls to top on view change.
  - An aurora `div` (`aria-hidden`) sits at the top of `.main-area`.
  - **Keep the existing focus-to-heading behaviour, skip link and mobile dialog.**

- [ ] **Step 1: Write the failing tests:**
  - `useCountUp(50)` under a stubbed reduced-motion `matchMedia` returns 50 on first render.
  - Without reduced motion it returns less than 50 at first and 50 after the duration (fake timers or `requestAnimationFrame` stub).
  - `usePageTransition` returns `page-leaving`, then `page-entering` after 160ms when the key changes, and `''`/instant under reduced motion.
- [ ] **Step 2:** Run `node tests/motion.test.mjs`. Expect it to fail.
- [ ] **Step 3:** Implement `motion.ts`, `CompassLogo.tsx` and the `App.tsx`/CSS changes.
- [ ] **Step 4:** `npm test` (including the existing `role-refresh` and `auth-ui` tests) and `npm run build` pass. In the fixture, switching pages lifts away and rises in with no circle, the pill slides, the logo settles, and the toggle reveals in a circle. With DevTools "Emulate reduced motion", nothing animates.
- [ ] **Step 5:** Commit `feat(ui): add shell motion, sliding navigation and animated logo`.

### Task 6: Command palette and G-shortcuts

**Files:**
- Create: `frontend/src/CommandPalette.tsx`, `frontend/src/shortcuts.ts`, `frontend/src/styles/palette.css`
- Modify: `frontend/src/App.tsx` (render the palette and pass the role's nav items and `navigate`)
- Test: `frontend/tests/palette.test.mjs`

**Interfaces:**
- Produces from `shortcuts.ts`:
  - `isTypingTarget(el:EventTarget|null): boolean` (true for input, textarea, select, contenteditable and anything inside `[role=dialog]`/`dialog[open]`)
  - `createGoShortcut(map:Record<string,View>, go:(v:View)=>void, timeoutMs=900): (e:KeyboardEvent)=>void`. `g` arms it. The next key within the timeout, if it's in `map` (`o`→overview, `w`→work, `r`→requirements, `c`→calendar), navigates. The handler ignores events with ctrl, alt or meta, and events where `isTypingTarget(e.target)` is true.
- Produces: `<CommandPalette items={{label:string;hint?:string;run:()=>void}[]}/>`:
  - Opens on Ctrl/⌘+K or the `eif:palette` window event.
  - Renders in a native `<dialog>` with `aria-label="Command palette"`.
  - The input filters by a case-insensitive substring. ArrowUp/Down move the selection, which wraps. Enter or a click runs the item and closes. Escape or a backdrop click closes.
  - Focus returns to the previously focused element. "No matches" shows when the list is empty.
  - Items: "Go to <label>" for each nav item of the current role, "Toggle dark mode", "Report a blocker" (→ blockers), and "Ask the AI assistant" (→ assistant).
- Motion: scale .96→1 with blur 4px→0 over 320ms `--ease-out`, and a scrim fade (prototype values).

- [ ] **Step 1: Write the failing tests:**
  - `isTypingTarget` is true for input, textarea, select and a contenteditable div, and false for a button.
  - The shortcut navigates to `work` on `g`,`w`. It doesn't navigate when `w` comes after 1000ms, when the target is an input, or with `ctrlKey`.
  - The palette opens on a Ctrl+K keydown. Typing `cal` leaves exactly 1 item. Enter calls that item's `run` and closes the dialog. With the query `zzz` it shows "No matches". Clicking an item runs it.
- [ ] **Step 2:** Run it. Expect it to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass. In the fixture, typing "feed" and clicking navigates to Feedback, and `g w` jumps to My work but does nothing inside the search input.
- [ ] **Step 5:** Commit `feat(ui): add command palette and keyboard navigation shortcuts`.

### Task 7: Overview polish and inline "Explain this"

**Files:**
- Create: `frontend/src/ExplainInline.tsx`, `frontend/src/StatusBadge.tsx`
- Modify: `frontend/src/Dashboard.tsx`, `frontend/src/App.tsx` (pass `client`, `userId`, `role`, `cohortId` and an `onOpenAssistant(action)` fallback that keeps today's `setAssistantExplanation` + `setView('assistant')` path), `frontend/src/styles/overview.css`
- Test: `frontend/tests/explain-inline.test.mjs`. Also extend `tests/dashboard-ui.test.mjs` for the badges.

**Interfaces:**
- Consumes: `historyRequest` from `assistant-history.ts`, `useCountUp` (Task 5), and the `Action` type from `shared/workflow-rules.mjs`.
- Produces: `<StatusBadge status={'overdue'|'pending'|'upcoming'|'in_review'|'completed'|'to_do'|'in_progress'|'for_review'} detail?:string/>`. It renders `span.status-badge.is-<x>` with an `aria-hidden` SVG icon (overdue: alert circle, pulsing; pending: half circle; upcoming: ring; in_review: eye; completed: check; task statuses: matching simple glyphs) and the label from Dashboard's existing `statusLabel` map, which moves into `StatusBadge.tsx` and is exported. Use it everywhere a status is shown: Dashboard, WorkManager, InternFlows and Agenda (the latter three are wired in Task 8).
- Produces: `<ExplainInline client userId role cohortId action={Action} question={string} onOpenAssistant={()=>void}/>`. Its state machine is `idle → loading-history → streaming → saved | unsaved | failed`, exactly as in spec 6a:
  - The POST body is identical to `Assistant.tsx`'s `ask()` for a target: `{message, intent:'explain_next_action', expectedAction:{id,view}, stream:true, conversationId, requestId, generation, revision}`.
  - Retry saving uses the `retrySave()` body.
  - One `AbortController` is aborted on unmount and whenever `action.id`, `userId` or `cohortId` changes. Late deltas are ignored using an epoch counter.
  - **Copy:** "Generating…" (with a blinking caret span `aria-hidden`), "Saved to your assistant history", "Continue in assistant", "Retry saving", "Incomplete — not saved", "Open in assistant".
  - The answer region is `aria-live="polite"` and `aria-busy` while streaming.
- **The question string** moves from `App.tsx` into a shared exported function `explainQuestion(action:Action):string` in `ExplainInline.tsx`. Its text is unchanged: ``Explain why “${action.title}” is my next recommended action, using its recorded reason and deadline. Give a practical first step.``
- **Dashboard (intern):**
  - The Next Best Action card gets the spotlight. The card sets `--mx/--my` from `pointermove` (fine pointer only, throttled with rAF). It gets the "✦ Suggested next step" chip, the title, the reason and due line (no ID chip), the primary Open action, and an "Explain this" ghost button that mounts `ExplainInline` below inside the card with an expanding height transition.
  - Metrics use `useCountUp`, and the journey bar animates its width from 0.
- **Lead dashboard:** the metrics count up, the team table rows glide on hover, and the drill-down panel expands with height and opacity.

- [ ] **Step 1: Write the failing tests** in `explain-inline.test.mjs`. Stub `fetch` and `client.auth.getSession`, and render with JSDOM + `act`:
  - **(a) Saved:** stream 3 deltas then `complete` with `historySaved:true`. "Generating…" is shown mid-stream, then the final text, "Saved to your assistant history", and a "Continue in assistant" button.
  - **(b) Not saved:** `complete` with `historySaved:false`. "Retry saving" is shown. Clicking it POSTs to `/api/assistant/history` with `requestId` equal to the streamed one, and then shows "Saved…".
  - **(c) Interrupted:** the stream errors after 1 delta. The partial text remains, "Incomplete — not saved" is shown, and "Open in assistant" calls `onOpenAssistant`.
  - **(d) Unmount mid-stream:** the fetch signal is aborted and no state-update warning appears.
  - **(e)** `explainQuestion({title:'X'})` equals the exact string above.
  - **Extend `dashboard-ui.test.mjs`:** each status badge has text plus an svg.
- [ ] **Step 2:** Run them. Expect them to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass. In `?fixture=intern`, "Explain this" streams in the card and shows Saved. Clicking "Continue in assistant" opens the Assistant page, where that answer appears in history (the fixture stores it). Under reduced motion the metrics show their final values immediately.
- [ ] **Step 5:** Commit `feat(overview): stream next-step explanation inline and polish dashboards`.

### Task 8: Work, requirements, calendar and fellowship pages motion (both roles)

**Files:**
- Modify: `frontend/src/WorkManager.tsx`, `frontend/src/SubmissionBin.tsx`, `frontend/src/DetailDrawer.tsx`, `frontend/src/InternFlows.tsx`, `frontend/src/Agenda.tsx`, `frontend/src/GoogleCalendar.tsx`, `frontend/src/motion.ts`, and the matching `styles/*.css`
- Test: extend `tests/workflows.test.mjs` or `tests/intern-flows.test.mjs` where they render these components, and `tests/motion.test.mjs`

**Interfaces:**
- Produces from `motion.ts`: `useRowGlide(listRef:RefObject<HTMLElement>, rowSelector:string): void`. It inserts one `.row-glide` element (`aria-hidden`) and moves it with `transform`/`height` to the hovered row (fine pointer only). It hides on pointerleave, and does nothing under reduced motion.
- Produces from `motion.ts`: `useCompletionFlash(): {flash(id:string):void; isFlashing(id:string):boolean}`. Flashing lasts 600ms.
- **WorkManager:**
  - When a status select changes to `completed` and the save succeeds, call `flash(id)`. While it's flashing, the row keeps rendering even if the current filter would hide it. It gets the `.is-completing` class, which draws the check and sweeps the strike-through (prototype CSS).
  - The existing toast text "Task status saved." is unchanged.
  - Lists use `useRowGlide`.
  - Status displays use `StatusBadge` (Task 7).
- **Requirements (lead review):** the review state change animates the badge (crossfade and scale .96→1), and the submission rows glide.
- **DetailDrawer:** slides in from the right over 280ms `--ease-out` with a backdrop blur fade. Closing animates out over 200ms before unmounting, and is instant under reduced motion. Existing focus handling and the unsaved-changes guard are unchanged.
- **InternFlows** (projects, feedback, blockers, notifications; lead variants included): rows glide, the milestone progress bars fill on arrival, the blocker discussion `details` expands smoothly (height via `grid-template-rows: 0fr→1fr`), unread notifications get a soft accent bar that fades out when marked read, and the flow tabs get a sliding underline pill (reuse `useSlidingIndicator`).
- **Agenda/Calendar:** day groups stagger in, date tiles use the prototype's tile style, today's group gets the accent, and the event manager (lead) form expands smoothly.

- [ ] **Step 1: Write the failing tests:**
  - `useCompletionFlash`: `isFlashing` is true right after `flash` and false after 600ms.
  - A WorkManager render where the filter hides completed tasks: after the status changes to completed, the row is still in the DOM with `.is-completing`, and is gone after 600ms.
  - Every status rendered by WorkManager and InternFlows has an svg plus text.
- [ ] **Step 2:** Run them. Expect them to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass. In both fixture roles, check each page in both themes: lists glide, the drawer animates in and out, completion animates, and the tabs slide.
- [ ] **Step 5:** Commit `feat(ui): add list, drawer and completion motion across work pages`.

### Task 9: Lead-specific polish pass

**Files:**
- Modify: `frontend/src/Dashboard.tsx` (lead branch), `frontend/src/WorkManager.tsx` (lead cohort tasks and review queue), `frontend/src/InternFlows.tsx` (lead feedback posting, blocker responses and resolution), `frontend/src/App.tsx` (the lead event manager toggle), and the matching CSS.

**Interfaces:**
- Consumes: everything from Tasks 5–8. **No new hooks.**
- **Deliverable:** every lead-only screen meets the same bar as the intern screens.
  - **Review queue:** approve and request-changes buttons show a busy state with the button shimmer from the login prototype, and the row animates out of the queue (`is-completing` pattern) after a successful review.
  - **Feedback post:** a successful post animates the new item into the top of the history.
  - **Blocker resolution:** a successful resolve animates the badge to Resolved.
  - **Team table drill-down:** expands smoothly.
  - **Event manager:** opens with the expand pattern.
  - The lead Assistant starters get hover glide.
- Copy is unchanged.

- [ ] **Step 1: Write a failing test.** In the existing lead-review test (`tests/submission-bin-ui.test.mjs` or `workflows.test.mjs`, whichever renders the review queue), after a successful review the row has `.is-completing` and is gone after 600ms. Concurrent review busy tracking still passes, because the existing test is unchanged.
- [ ] **Step 2:** Run it. Expect it to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass. Walk through `?fixture=lead` on every page in both themes. Nothing looks less finished than the intern side.
- [ ] **Step 5:** Commit `feat(lead): bring lead workflows to full Deep Lagoon polish`.

### Task 10: Assistant page streaming treatment

**Files:** Modify `frontend/src/Assistant.tsx` (presentation only) and `frontend/src/assistant.css`. Test: extend `frontend/tests/assistant-ui.test.mjs`.

**Interfaces:**
- **Partial answer:** while `partial` is set, the answer bubble shows the blinking caret (`span.stream-caret`, `aria-hidden`) and the label "Generating…".
- **Interrupted answer:** the existing incomplete state keeps its current wording and gains the muted "Incomplete" styling.
- **Motion:** new turns rise in (8px, blur), the starters glide on hover, and the composer has the token focus ring.
- **No logic changes** to `ask`, `retrySave`, `clear` or `load`.

- [ ] **Step 1: Write a failing test.** In `assistant-ui.test.mjs`, during a stubbed stream the DOM contains `.stream-caret` and "Generating…". After completion neither is present.
- [ ] **Step 2:** Run it. Expect it to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass.
- [ ] **Step 5:** Commit `feat(assistant): add streaming caret and turn motion`.

### Task 11: Sign-in motion, cursor-following journey, and arrival overlay

**Files:**
- Create: `frontend/src/journey.ts`
- Modify: `frontend/src/AuthGate.tsx`, `frontend/src/auth.css`
- Test: `frontend/tests/journey.test.mjs`. Also extend `tests/auth-ui.test.mjs`.

**Interfaces:**
- Produces from `journey.ts`:
  - `type Pt={x:number;y:number}`
  - `const REST` holds the rest points of the main line in the 550×190 viewBox: `[{x:20,y:152},{x:168,y:152},{x:276,y:44},{x:530,y:44}]`. The ghost lines are offset (+13,+16) and (−13,−16).
  - `journeyTargets(pointer:Pt|null, maxOffset=28): Pt[]`. With `null` it returns `REST`. Otherwise each point moves toward the pointer by `maxOffset * falloff`, where `falloff = 1/(1+dist/180)`, and the offset is capped at `maxOffset`.
  - `stepToward(current:Pt[], target:Pt[], k=0.14): {points:Pt[]; settled:boolean}` (damped lerp; `settled` when every delta is under 0.1).
  - `pathD(points:Pt[], offset?:Pt): string` (`M x y H…`-free polyline `M x y L x y …`).
  - `nearestOnPath(points:Pt[], x:number): Pt` (the point on the polyline at that x, clamped).
- **AuthGate journey SVG:** after the intro (2.8s), on pointer movement over `.studio-login-story` (fine pointer, no reduced motion), it converts the pointer to viewBox coordinates. One rAF loop updates the `d` of the main path and the two ghost paths (ghosts use `maxOffset` 14 for parallax), the node `cx/cy`, and the traveller position (`nearestOnPath`). The loop stops when settled. On pointerleave the target becomes `REST`.
- **Intro motion** (from the prototype): logo settle (`CompassLogo`), headline line-mask rise with the "clear direction." sheen, path draw with a travelling light and node pops, last-node ping, aurora and grid, form glow, focus rings, error shake with slide-in (on a `role="alert"` change), and the busy shimmer on submit. `ThemeToggle` sits top-right.
- **Arrival overlay:** when a session appears after a submit (not on restore), render `children(session)` **immediately**, plus a fixed overlay sibling `.arrival` (`aria-hidden`) that clips open from the submit button's centre over 900ms, shows `CompassLogo` and "Opening your workspace…", fades, and unmounts itself after 1600ms. Under reduced motion it isn't rendered.

- [ ] **Step 1: Write the failing tests:**
  - `journeyTargets(null)` deep-equals `REST`.
  - With the pointer at `{x:276,y:44}`, point 2 moves less than 1 unit (the distance is 0, so the direction is undefined and it must not move or produce NaN), and no coordinate is NaN.
  - With the pointer far away (`{x:5000,y:5000}`), every offset is at most 28.
  - `stepToward` reaches `settled:true` within 200 iterations.
  - `pathD(REST)==='M20 152 L168 152 L276 44 L530 44'`.
  - `nearestOnPath(REST,222)` gives `{x:222,y:98}`.
  - **`auth-ui.test.mjs`:** the existing assertions still pass, and after a successful sign-in "Signed in fellow" is in the DOM in the same `act` tick.
- [ ] **Step 2:** Run them. Expect them to fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` and `npm run build` pass. Sign out in the fixture: the intro plays, the line bends toward the cursor and springs back on leave, the light tracks the cursor's x position, and signing in opens the workspace with the circle overlay. Check both themes.
- [ ] **Step 5:** Commit `feat(auth): animate sign-in with cursor-following journey and arrival overlay`.

### Task 12: Verification, docs and push

**Files:** Modify `docs/ui-redesign.md` (append a "Deep Lagoon" section covering what changed, verification and limits) and `docs/superpowers/implementation-ledger.md` (one entry).

- [ ] **Step 1:** `cd frontend; npm test; npm run build`. Both pass. Record the bundle sizes from the build output, and confirm `dist` doesn't contain the fixture (`Fellowship Resource Hub`).
- [ ] **Step 2: Playwright.** In both themes at 1440×900, 1280×800 and 390×844, using `npm run dev` with `?fixture=intern` and `?fixture=lead`: sign-in, then every page in the nav for each role, plus the drawer open, the palette open and the inline explanation saved. Save screenshots to `frontend/.test-output/lagoon-*.png` (gitignored). Check:
  - no horizontal overflow at 390px (`document.documentElement.scrollWidth <= innerWidth`)
  - the long title and long name wrap correctly
  - no flash of the wrong theme on reload with stored `dark`
  - the reduced-motion emulation shows final numbers immediately
  - the page switch never shows a circular clip
  - AA contrast for `--muted` on `--surface` in both themes (compute it in `browser_evaluate`)
- [ ] **Step 3:** Fix anything found, re-running Step 1 after each fix.
- [ ] **Step 4:** Update the docs, then commit `docs: record Deep Lagoon redesign verification`.
- [ ] **Step 5:** `git push -u origin feat/deep-lagoon-redesign` (PowerShell). Report the branch URL.

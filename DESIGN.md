---
name: EIF Compass — Fellowship Studio
description: A teal fellowship workspace for clear priorities, shared progress, and thoughtful guidance.
colors:
  primary: "#176f70"
  forest: "#245862"
  ink: "#203f43"
  muted: "#526d70"
  canvas: "#f4f8f6"
  paper: "#ffffff"
  sage: "#deeee7"
  line: "#d7e5e2"
typography:
  heading:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "8px"
  panel: "12px"
spacing:
  small: "8px"
  group: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
---

## Overview

Fellowship Studio balances efficient daily work with a warm, professional fellowship identity. Interns must quickly identify their next task, update work, and submit requirements. Leads prioritize reviews, blockers, and team progress. Use real records and meaningful progress; never invent activity, urgency, or cohort duration.

## Colors

Deep teal navigation frames a warm canvas. Teal identifies actions, pale sage groups priority context, and white marks working surfaces. Amber identifies attention and red identifies errors/destructive actions. Status always includes a text label. Shared application tokens live in `frontend/src/brand.css`; scoped auth and assistant styling inherit this system.

## Typography

Manrope is self-hosted under `frontend/public/fonts` with its OFL license. Use strong headings, comfortable reading text, and compact metadata. Headings carry hierarchy without decorative eyebrow labels. Tabular numerals support metrics. Wrap long record titles and filenames.

## Layout

Desktop uses a 244px labeled sidebar and inset workspace. Daily work, Fellowship, and Tools group navigation. Below 1200px, a native modal navigation drawer replaces the sidebar. Below 768px, records stack and detail drawers fill the screen. Main content never requires horizontal scrolling; wide lead tables scroll inside their container. Overview leads with actual cohort progress and next action, followed by compact metrics and working queues.

## Elevation & Depth

Use light ambient shadows for working panels and stronger soft shadows for floating account options and record drawers. Glass is limited to the workspace header, floating menus, and drawer header, with a readable opaque fallback. Blur the background behind record drawers by 3px. Avoid stacking panels merely to add decoration.

## Shapes

Panels use 12px radii; buttons and fields use 7–9px radii. Small status labels use compact rounded corners. The logo is a directional compass mark in teal and mint.

## Components

- Use one primary action per working section, descriptive labels, visible focus, and explicit account sign-out.
- Task rows support inline status updates and focused details. Requirement drawers contain existing submission capabilities and lead review decisions.
- Record drawers trap and restore focus, protect unsaved changes, and prevent closure while any submission operation remains active.
- Assistant starters populate the composer. Sending remains explicit. Preserve saved-history, stop, privacy, and draft-only boundaries.
- Reveal project setup, feedback composition, and blocker reporting through deliberate actions.
- Use 300ms hover and overlay transitions with a 60ms hover dwell and 100ms press feedback, a 1–2px hover lift, and gently buoyant menus/drawers. Keyboard entry and reduced-motion preferences disable movement.
- Primary actions and assistant starters emit six small click bubbles over 620–710ms. Throttle bursts to 240ms and cap at two simultaneous bursts. Never emit on keyboard, disabled, destructive, frequent utility, hidden-page, reduced-motion, or forced-colors interactions. Effects confirm a press, not a successful operation. No idle animation loops.

## Do's and Don'ts

Use real cohort names, meaningful icons, accessible status text, and locally scoped errors. Preserve authorization and deadline rules. Do not add fake workspace selectors, duplicate account controls, decorative charts, shimmer buttons, or unsupported social login.

Navigation slides for 300ms on pointer open and close, remaining modal through exit. Keyboard and reduced-motion interactions remain immediate. Shared controls use 300ms visual transitions and 60ms hover dwell across pages. Hoverable list rows use 16px vertical and 14px horizontal padding; title buttons include 6px/8px internal padding so highlights never touch text.

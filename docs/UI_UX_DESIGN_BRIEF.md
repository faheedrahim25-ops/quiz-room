# Mentor360 UI/UX Design Brief

## Direction

A calm, colorful academic operations workspace: warm white surfaces, ink navy typography, blue action color, mint success, peach warnings, and lilac secondary accents. DM Sans supports scanning; Manrope gives headings a confident editorial edge. Avoid purple gradients, glass effects, dense decoration, and public rankings.

## Tokens

- Primary `#5F8DF7`; success `#4AA482`; warning `#DF8C54`; danger `#D96868`; info `#668DF3`.
- Background `#F7F9FC`; surface `#FFFFFF`; border `#E8ECF3`; primary text `#17253F`; muted `#8994A7`.
- Radius: 7px controls, 13px panels, 11px avatars. Spacing: 4/8/12/16/24/32/40.
- Breakpoints: 700px mobile, 1000px tablet, 1280px desktop.

## Screen Contract

Every screen specifies purpose, role, entry point, sections, data, actions, validation, loading, empty, error, success, responsive behavior, accessibility, and navigation in the implementation issue for that module.

Core screens: role dashboard; student/faculty lists and profiles; assignment workspace; question list/create/edit/preview; quiz wizard/detail/attempts/results/evaluation; result/performance; feedback; meetings; notifications; announcements; reports; audit logs; settings; login/reset.

## Interaction Rules

Use semantic landmarks, visible focus, icon plus text for unfamiliar actions, confirmation for destructive or publish actions, keyboard-accessible dialogs, table-to-card conversion on mobile, and non-color status indicators. Charts expose a text summary and accessible label. Every action has a disabled/loading state and every API-backed screen has skeleton, empty, and recoverable error states.

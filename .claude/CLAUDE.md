# CIT Actor Scheduler — Project Instructions

## What This Is
Monthly scheduling tool for NYPD Crisis Intervention Training (CIT) actors.
Built for Cynthia — non-technical user who manages ~11 actors across 9 training scenarios.

## Tech Stack
- **Framework**: Vite + React (single-page app)
- **Styling**: Inline styles (no CSS framework) — dark theme
- **Storage**: localStorage via `src/storage.js` adapter
- **Deployment**: Vercel (static site)
- **PWA**: Service worker + manifest for phone installability

## Key Files
| File | Purpose |
|------|---------|
| `src/CITScheduler.jsx` | Main component (all UI + logic) |
| `src/storage.js` | localStorage adapter + backup export/import |
| `src/main.jsx` | React entry point + SW registration |
| `CIT-SCHEDULER-SPEC.md` (parent dir) | Full business spec — source of truth for all rules |

## Business Rules (Summary)
- 3 training slots (Day 1/2/3), default Tue/Wed/Thu, adjustable per-week
- 2 shifts per day: AM (Noon) and PM (8 PM)
- 9 scenarios across 3 slots, each with NYPD-approved actor lists
- 1 actor per scenario per shift, 1 scenario per actor per shift
- Conflict rules (e.g., can't play Jumper + Depression same shift)
- See `CIT-SCHEDULER-SPEC.md` for complete rules

## Storage Keys
- `cit-v4-config` — global config (actors, scenarios, rules)
- `cit-v4-YYYY-MM` — monthly data (1-based month: `cit-v4-2026-03` = March)
- `cit-v4-welcomed` — welcome modal shown flag

## Commands
```powershell
# Install dependencies
cd cit-app; npm install

# Dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Frontend Development (NON-NEGOTIABLE)
- **Use `impeccable` plugin** for all UI polish, refinement, and quality passes
- **Use `ui-ux-pro-max` skill** for all design decisions, color choices, layout, and UX
- Every UI change must pass through these tools — no exceptions
- Mobile-first: all touch targets 44px minimum
- Dark theme must be consistent and polished across every element

## Agent Teams (NON-NEGOTIABLE)
- Every phase that can be parallelized MUST use agent teams
- Team lead + domain expert agents per phase
- No solo work when team work is possible
- Each agent must research before acting — read project files, check docs

## GSD Planning
- All planning docs live in `.planning/`
- STATE.md, REQUIREMENTS.md, ROADMAP.md, PROJECT.md maintained
- Mistakes tracked in `.planning/mistakes/` to prevent repeats
- State docs updated at end of every session

## Critical Requirements
1. **ICS export MUST work** — RFC 5545 compliant, imports into Google Calendar
2. **Mobile-first** — touch targets 44px+, works on phones
3. **Simple UX** — user is not tech-savvy
4. **No backend** — everything runs client-side with localStorage
5. **Must work flawlessly** — no half-measures, no "good enough"

## Don't
- Don't use `window.storage` — use the storage adapter from `src/storage.js`
- Don't use `localStorage` directly — go through the adapter
- Don't add external dependencies without checking if they're needed
- Don't skip impeccable/ui-ux-pro-max for any UI work
- Don't skip agent teams for parallelizable work

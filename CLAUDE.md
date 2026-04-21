# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm dev           # Watch mode (esbuild)
pnpm build         # Type check + production bundle
pnpm lint          # Biome lint check
pnpm lint:fix      # Biome lint with auto-fix
pnpm format        # Biome format check
```

No test framework is configured.

## Code Quality

- **Biome** is configured for linting and formatting (`biome.json`)
- After any code change, run `pnpm check` to ensure no lint or formatting issues remain before committing — this catches problems early and keeps the codebase consistent
- Fix all errors and warnings reported by Biome before considering a task complete

## Code Commit Convention

- Commit message prefixes must use Conventional Commit style, such as `fix:`, `feat:`, `refactor:`, `docs:`
- When helpful, include the module scope, for example: `fix(hotkey): ...`, `feat(settings): ...`
- The message body after the prefix must explain **why**, not just **what**
- Keep commit messages short, clear, and traceable
- Avoid vague descriptions such as "improve performance", "optimize code", "fix issue"
- Preferred examples:
  - `fix(hotkey): avoid accidental hold trigger while pressing modifier combos`
  - `feat(settings): support hold-to-talk for users who prefer press-and-release input`
- All code comments must be written in English

## Architecture

Obsidian plugin integrating FullCalendar to display daily note tasks on a calendar view.

**Entry flow:** `src/main.ts` registers the calendar view, daily note service, and settings tab.

**View layer** (`src/view/`):
- `CalendarView.ts` — Obsidian ItemView managing FullCalendar lifecycle, handles date selection to open daily notes
- `calendarRenderer.ts` — Creates/configures FullCalendar instance, maps Obsidian theme CSS variables to FullCalendar

**Services** (`src/services/`):
- `DailyNoteService` — Parses daily note files for tasks, handles file events (change/delete/rename), caches results, notifies observers
- `EventMapper` — Converts internal CalendarEvent objects to FullCalendar EventInput format

**Types** (`src/types/index.ts`): `CalendarEvent`, `TaskInfo`, `ObCalendarSettings` interfaces.

## Key Details

- FullCalendar v6 packages (`@fullcalendar/core`, `daygrid`, `timegrid`, `list`, `interaction`) are the main UI dependency
- Tasks are parsed from daily notes under a configurable heading, with checkbox format: `[ ]` initial, `[✓]` completed, `[/]` incomplete, `[x]` cancelled
- Inline properties (`startTime`, `endTime`) in task lines are extracted for time-based display
- `esbuild.config.mjs` externalizes `obsidian`, `electron`, CodeMirror modules, and Node builtins
- Biome is the linter/formatter (tab indent, 80 char line width)
- TypeScript strict mode with ESNext modules, ES6 target
- `styles.css` maps FullCalendar CSS vars to Obsidian theme variables for native look

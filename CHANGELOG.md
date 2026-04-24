# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.0.11] - 2026-04-24

### Fixed
- Removed unnecessary async callbacks flagged by Obsidian community plugin review.

## [0.0.10] - 2026-04-24

### Added
- i18n support for Chinese (zh-CN) and English (en)
- Obsidian-specific ESLint checks for community plugin review rules

### Changed
- Refactored common time functions into `src/utils/time.ts`
- Improved y-axis label formatting in stats bar chart (rounded to hours)
- Updated English UI copy to use sentence case

### Fixed
- Fixed FullCalendar toolbar wrapping issue on mobile
- Replaced direct `localStorage` and `document` usage with Obsidian-compatible APIs
- Fixed unhandled promise, unsafe type, unnecessary assertion, and async callback lint issues
- Replaced direct `style.display` toggles with CSS classes

## [0.0.6] - 2025-04-22

### Added
- Dashboard with ECharts (donut chart for task status, bar chart for daily time spent)
- Stats cards showing total tasks, completion rate, and total duration with period comparison

### Fixed
- Changed setting items layout to use Obsidian native setting group

## [0.0.5] - 2025-04-21

### Added
- Right-click context menu to change task status directly on calendar

### Fixed
- Optimized settings UI layout
- Fixed Biome lint warnings

## [0.0.4] - 2025-04-20

### Changed
- Refactored settings to use Obsidian native `SettingGroup` layout

## [0.0.3] - 2025-04-19

### Added
- GitHub release script with version validation and one-command release

### Fixed
- Task status colors to match Obsidian baseline theme
- Default colors for task status and buttons

## [0.0.2] - 2025-04-17

### Added
- Delete task from calendar modal

### Fixed
- Daily note date folder format
- Overflow event text in calendar

## [0.0.1] - 2025-04-14

### Added
- Calendar view based on FullCalendar
- Task display from daily notes
- Task creation and editing modal
- Daily note integration with configurable heading
- Settings panel with customizable task status colors
- Mobile responsive layout
- BRAT publishing support via GitHub Actions

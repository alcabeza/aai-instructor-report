# Changelog

All notable changes to this project are documented here. Versions follow [semantic versioning](https://semver.org/).

## [1.1.0] - 2026-11-27

### Changed
- Interface in English (report, portal button, extension name, Windows installer).
- CSAT colour scale: green at or above 4.75, then orange to red down to 4.0. Applied to the indicator, summary, session dots and course bars.

### Added
- 4.75 threshold line ("Minimum to remain instructor") and shaded zone on the CSAT-per-session chart.
- Threshold reminder under the CSAT indicator.
- Windows installer (`installer/windows`).
- Preview harness with fictional data (`tests/preview`) and build script (`scripts/build.sh`).

## [1.0.0] - 2026-11-27

### Added
- First version (French interface): button on the portal's Technical Instructor page, collection of Delivery CSAT, Progress, Approved Courses, Ramping Courses, Certifications and Providers, report with indicators, charts, certifications, AI badges and catalogue, Print / PDF and JSON export.

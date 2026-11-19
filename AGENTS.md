# Instructions

## Build & Release Conventions
- Always use dot-delimited artifact naming for releases (`My.Music.Setup.${version}.exe`, `My.Music.Portable.${version}.exe`).
- Ensure `latest.yml` always references `My.Music.Setup.${version}.exe` with dots so auto-updater downloads match GitHub release assets.

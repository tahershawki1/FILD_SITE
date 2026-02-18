# Version Locations

Update release version in these files only:

1. `mobile_shell_flutter/pubspec.yaml`
- Field: `version`
- Format: `x.y.z+build`
- Current: `1.0.0+1`

2. `field-site/version.json`
- Fields: `version`, `releasedAt`, `minShell`
- Current: `version = 1.0.0`

3. `field-site/sw.js`
- Field: `CACHE_VERSION`
- Format: `vX.Y.Z`
- Current: `v1.0.0`

Note:
- Flutter app no longer bundles an offline site copy. The app downloads `field-site` files and stores them in internal storage.

One-command release update:
- `powershell -ExecutionPolicy Bypass -File scripts/bump_release_version.ps1 -Version 1.0.0 -BuildNumber 1 -MinShell 1.0.0`

Preview only (no write):
- `powershell -ExecutionPolicy Bypass -File scripts/bump_release_version.ps1 -Version 1.0.0 -BuildNumber 1 -MinShell 1.0.0 -DryRun`

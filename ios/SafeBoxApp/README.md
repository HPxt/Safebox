# SafeBoxApp SwiftUI Target

This folder contains the first real SwiftUI host app shell for iOS v1.

It is intentionally generated from `project.yml` with XcodeGen instead of committing a hand-written `.xcodeproj`.

```bash
cd ios/SafeBoxApp
xcodegen generate
open SafeBox.xcodeproj
```

Current scope (2026-10-24):

- native SwiftUI login, unlock, vault list and settings screens;
- coordinator wired to `SafeBoxCore` E5 services;
- HTTP adapters for Supabase auth/session rotation, KDF profile and vault sync;
- staging-only runtime configuration with HTTPS/public-key validation;
- XCTest session/configuration security tests and macOS CI;
- App Store baseline files: Info.plist, entitlements and Privacy Manifest.

Still required before TestFlight:

- provision a separate staging Supabase project and backend, using synthetic data;
- populate ignored `Config/Local.xcconfig` (see `docs/ios/security-first-delivery.md`);
- pass the macOS CI builds and XCTest suite;
- complete issuer/backend/RLS MFA enforcement;
- run on a real iPhone with Face ID/Touch ID;
- complete the AutoFill selection UI and protected secret resolver (target already exists).

No signed archive, real-device validation or TestFlight upload is claimed by source checks.

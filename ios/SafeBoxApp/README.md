# SafeBoxApp SwiftUI Target

This folder contains the first real SwiftUI host app shell for iOS v1.

It is intentionally generated from `project.yml` with XcodeGen instead of committing a hand-written `.xcodeproj`.

```bash
cd ios/SafeBoxApp
xcodegen generate
open SafeBox.xcodeproj
```

Current scope:

- native SwiftUI login, unlock, vault list and settings screens;
- coordinator wired to `SafeBoxCore` E5 services;
- production adapter protocols/placeholders for auth, KDF profile and vault sync;
- App Store baseline files: Info.plist, entitlements and Privacy Manifest.

Still required before TestFlight:

- implement real Supabase auth/session adapter;
- inject production backend/Supabase URLs and tokens from secure configuration;
- run on a real iPhone with Face ID/Touch ID;
- add AutoFill extension target.

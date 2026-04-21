# SafeBox Host Info.plist Template (v1)

Use this baseline for the host app target.

```xml
<key>CFBundleDisplayName</key>
<string>SafeBox</string>

<key>CFBundleIdentifier</key>
<string>app.safebox.ios</string>

<key>LSApplicationCategoryType</key>
<string>public.app-category.utilities</string>

<key>UIRequiredDeviceCapabilities</key>
<array>
    <string>arm64</string>
</array>

<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>

<key>NSFaceIDUsageDescription</key>
<string>O SafeBox usa Face ID/Touch ID para desbloquear seu cofre com seguranca.</string>

<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>

<key>ITSAppUsesNonExemptEncryption</key>
<true/>
<!-- ITSEncryptionExportComplianceCode preencher apos questionario no App Store Connect -->
```

Rules:

- Do not add camera/photos/location keys unless features actually use them.
- Keep ATS strict (`NSAllowsArbitraryLoads = false`).
- Export compliance keys must be aligned with App Store Connect questionnaire.


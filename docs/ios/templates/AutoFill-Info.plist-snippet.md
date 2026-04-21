# AutoFill Extension Info.plist snippet (v1)

Use este bloco no target da extensao Credential Provider.

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.authentication-services-credential-provider-ui</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).CredentialProviderViewController</string>
</dict>

<key>ASCredentialProviderExtensionCapabilities</key>
<dict>
    <key>ProvidesPasswords</key>
    <true/>
</dict>
```

Checklist rapido:

- bundle id da extensao diferente do host
- entitlements da extensao com App Group + Keychain Access Group iguais ao host
- sem associated domains na extensao (fica no host)


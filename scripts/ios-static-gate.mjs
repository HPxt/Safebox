import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

const read = (relativePath) => {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing file: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(fullPath, 'utf8')
}

const expectIncludes = (relativePath, needle, label = needle) => {
  const text = read(relativePath)
  if (!text.includes(needle)) {
    failures.push(`${relativePath} missing ${label}`)
  }
}

const expectNotIncludes = (relativePath, needle, label = needle) => {
  const text = read(relativePath)
  if (text.includes(needle)) {
    failures.push(`${relativePath} must not include ${label}`)
  }
}

const expectRegex = (relativePath, pattern, label) => {
  const text = read(relativePath)
  if (!pattern.test(text)) {
    failures.push(`${relativePath} missing ${label}`)
  }
}

const files = [
  'docs/ios/e8-app-store-compliance-package.md',
  'docs/ios/e9-hardening-and-safe-observability.md',
  'docs/ios/e10-release-candidate-and-xcode-cloud-gate.md',
  '.gitguardian.yaml',
  'ios/SafeBoxApp/Sources/Support/Info.plist',
  'ios/SafeBoxApp/Sources/Support/SafeBox.entitlements',
  'ios/SafeBoxApp/Sources/Support/PrivacyInfo.xcprivacy',
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/Info.plist',
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/SafeBoxAutoFill.entitlements',
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/PrivacyInfo.xcprivacy',
]

for (const file of files) {
  read(file)
}

expectIncludes('ios/SafeBoxApp/Sources/Support/Info.plist', 'NSFaceIDUsageDescription')
expectIncludes('ios/SafeBoxApp/Sources/Support/Info.plist', 'ITSAppUsesNonExemptEncryption')
expectRegex('ios/SafeBoxApp/Sources/Support/Info.plist', /NSAllowsArbitraryLoads<\/key>\s*<false\/>/, 'ATS strict false')
expectNotIncludes('ios/SafeBoxApp/Sources/Support/Info.plist', 'NSExceptionDomains')

expectIncludes('ios/SafeBoxApp/Sources/Support/SafeBox.entitlements', 'webcredentials:safebox.app')
expectIncludes('ios/SafeBoxApp/Sources/Support/SafeBox.entitlements', 'applinks:safebox.app')
expectIncludes('ios/SafeBoxApp/Sources/Support/SafeBox.entitlements', 'group.app.safebox.ios.shared')
expectIncludes('ios/SafeBoxApp/Sources/Support/SafeBox.entitlements', '$(AppIdentifierPrefix)app.safebox.ios.shared')

expectIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/SafeBoxAutoFill.entitlements',
  'com.apple.developer.authentication-services.autofill-credential-provider'
)
expectIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/SafeBoxAutoFill.entitlements',
  'group.app.safebox.ios.shared'
)
expectIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/SafeBoxAutoFill.entitlements',
  '$(AppIdentifierPrefix)app.safebox.ios.shared'
)

expectRegex('ios/SafeBoxApp/Sources/Support/PrivacyInfo.xcprivacy', /NSPrivacyTracking<\/key>\s*<false\/>/, 'tracking false')
expectRegex(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/PrivacyInfo.xcprivacy',
  /NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/,
  'extension has no independent data collection'
)
expectNotIncludes('ios/SafeBoxApp/Sources/Support/PrivacyInfo.xcprivacy', 'NSPrivacyCollectedDataTypeOtherUserContent')
expectNotIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/Support/PrivacyInfo.xcprivacy',
  'NSPrivacyCollectedDataTypeOtherUserContent'
)

expectNotIncludes(
  'ios/SafeBoxApp/Sources/Networking/NetworkAdapters.swift',
  'String(decoding: data',
  'raw HTTP body propagation'
)
expectIncludes('ios/SafeBoxApp/Sources/Networking/NetworkAdapters.swift', 'httpRequestFailed')

expectIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/CredentialProviderViewController.swift',
  'provideCredentialWithoutUserInteraction'
)
expectIncludes(
  'ios/SafeBoxApp/SafeBoxAutoFillExtension/Sources/CredentialProviderViewController.swift',
  'userInteractionRequired'
)

expectIncludes('.gitguardian.yaml', '.cursor/skills/swift-crypto-parity/test-vectors.json')
expectIncludes('.gitguardian.yaml', 'ios/SafeBoxCore/Tests/SafeBoxCryptoTests/Fixtures/test-vectors.json')

const personalConfig = 'ios/SafeBoxApp/Config/PersonalStaging.xcconfig'
expectIncludes(personalConfig, 'SAFEBOX_PERSONAL_STAGING')
expectIncludes(personalConfig, 'xxynxmktvonnldokhyem.supabase.co')
expectIncludes(personalConfig, 'safebox-backend-staging.vercel.app')
expectNotIncludes(personalConfig, '#include')
expectRegex(personalConfig, /^CODE_SIGN_ENTITLEMENTS =\s*$/m, 'no shared signing entitlements')
expectNotIncludes('ios/SafeBoxApp/project.personal-staging.yml', 'SafeBoxAutoFillExtension')
expectIncludes('ios/SafeBoxApp/project.personal-staging.yml', 'app.safebox.ios.personalstaging')
expectIncludes('ios/SafeBoxApp/Sources/App/RuntimeConfiguration.swift', '#if SAFEBOX_PERSONAL_STAGING')

if (failures.length) {
  console.error('iOS static gate failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('iOS static gate passed.')

// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "SafeBoxNativeValidation",
    platforms: [.macOS(.v13)],
    dependencies: [.package(path: "SafeBoxCore")],
    targets: [
        .target(
            name: "SafeBoxNativeAdapters",
            dependencies: [.product(name: "SafeBoxCrypto", package: "SafeBoxCore")],
            path: "SafeBoxApp/Sources",
            exclude: ["Features", "Models", "Support", "SafeBoxApp.swift",
                      "App/AppCoordinator.swift", "App/BiometricVaultKeyStore.swift",
                      "App/CredentialIdentityDonationService.swift"],
            sources: ["Networking/NetworkAdapters.swift", "App/SafeBoxAppEnvironment.swift",
                      "App/RuntimeConfiguration.swift"]
        ),
        .testTarget(name: "SafeBoxNativeValidationTests", dependencies: ["SafeBoxNativeAdapters"],
                    path: "NativeValidationTests"),
        .testTarget(name: "SafeBoxNativeSessionTests", dependencies: ["SafeBoxNativeAdapters"],
                    path: "SafeBoxApp/Tests"),
    ]
)

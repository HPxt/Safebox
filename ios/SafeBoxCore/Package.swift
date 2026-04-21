// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "SafeBoxCore",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "SafeBoxCrypto",
            targets: ["SafeBoxCrypto"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "SafeBoxCrypto",
            dependencies: [
                "CArgon2",
                .product(name: "Crypto", package: "swift-crypto"),
            ],
            path: "Sources/SafeBoxCrypto"
        ),
        .target(
            name: "CArgon2",
            path: "Sources/CArgon2",
            exclude: [
                "LICENSE.argon2.txt",
            ],
            sources: [
                "blake2/blake2b.c",
                "argon2.c",
                "core.c",
                "encoding.c",
                "ref.c",
                "thread.c",
            ],
            publicHeadersPath: "include",
            cSettings: [
                .define("ARGON2_NO_THREADS"),
                .headerSearchPath("."),
                .headerSearchPath("blake2"),
            ]
        ),
        .testTarget(
            name: "SafeBoxCryptoTests",
            dependencies: ["SafeBoxCrypto"],
            path: "Tests/SafeBoxCryptoTests",
            resources: [
                .process("Fixtures")
            ]
        ),
    ]
)

"""Validate and package an unsigned, device-only personal staging app."""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import re
import subprocess
import zipfile


EXPECTED = {
    "CFBundleIdentifier": "app.safebox.ios.personalstaging",
    "CFBundleDisplayName": "SafeBox Staging",
    "SafeBoxEnvironment": "staging",
    "SafeBoxSupabaseURL": "https://xxynxmktvonnldokhyem.supabase.co",
    "SafeBoxBackendURL": "https://safebox-backend-staging.vercel.app",
    "SafeBoxPublishableKey": "sb_publishable_4_j0-3MA5vPNhLbAIsuwzw_UA1SjRg3",
    "SafeBoxPersonalStaging": True,
}


def inspect_bundle(app):
    if app.is_symlink() or not app.is_dir() or app.suffix != ".app":
        raise ValueError("Expected a real app directory")
    with (app / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
    for key, expected in EXPECTED.items():
        if info.get(key) != expected:
            raise ValueError(f"Unexpected {key}")
    if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
        raise ValueError("Only iPhoneOS device builds may be packaged")
    ats = info.get("NSAppTransportSecurity", {})
    if ats != {"NSAllowsArbitraryLoads": False}:
        raise ValueError("ATS must remain strict, without exceptions")
    if not info.get("NSFaceIDUsageDescription"):
        raise ValueError("Missing biometric permission description")
    if not (app / "PrivacyInfo.xcprivacy").is_file():
        raise ValueError("Missing privacy manifest")
    executable = info.get("CFBundleExecutable", "")
    if not executable or Path(executable).name != executable or not (app / executable).is_file():
        raise ValueError("Invalid executable")
    forbidden_suffixes = {".appex", ".p12", ".p8", ".pem", ".key", ".mobileprovision", ".entitlements"}
    for item in app.rglob("*"):
        if item.is_symlink():
            raise ValueError("Unexpected symlink in app")
        if item.suffix.lower() in forbidden_suffixes or item.name in {"PlugIns", "_CodeSignature"} or item.name.startswith(".env"):
            raise ValueError(f"Forbidden app entry: {item.name}")
    return info


def package(app, output, commit):
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Pass the exact source commit")
    if subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() != commit:
        raise ValueError("Source commit does not match the checkout")
    info = inspect_bundle(app)
    binary = app / info["CFBundleExecutable"]
    arches = subprocess.check_output(["lipo", "-archs", str(binary)], text=True).strip()
    if arches != "arm64":
        raise ValueError("Expected only arm64")
    build = subprocess.check_output(["xcrun", "vtool", "-show-build", str(binary)], text=True)
    if not re.search(r"platform\s+IOS\s", build) or "IOSSIMULATOR" in build:
        raise ValueError("Mach-O is not an iOS device executable")
    output.mkdir(parents=True, exist_ok=True)
    ipa = output / "SafeBox-Personal-Staging-unsigned.ipa"
    with zipfile.ZipFile(ipa, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(app.rglob("*")):
            if item.is_file():
                archive.write(item, Path("Payload") / app.name / item.relative_to(app))
    digest = hashlib.sha256(ipa.read_bytes()).hexdigest()
    (output / (ipa.name + ".sha256")).write_text(f"{digest}  {ipa.name}\n", encoding="ascii")
    manifest = {"sourceCommit": commit, "sha256": digest, "signed": False,
                "platform": "iPhoneOS", "architecture": arches, "autoFillIncluded": False,
                "requiresLocalResigning": True, "bundle": EXPECTED}
    (output / "validation.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="ascii")
    print(f"Validated unsigned staging IPA: {ipa.name}; SHA-256: {digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    package(args.app, args.output, args.commit)

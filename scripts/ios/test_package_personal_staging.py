import plistlib
from pathlib import Path
import tempfile
import unittest
from package_personal_staging import EXPECTED, inspect_bundle


class PackageSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = Path(self.temp.name) / "SafeBoxPersonalStaging.app"
        self.app.mkdir()
        self.info = dict(EXPECTED, CFBundleSupportedPlatforms=["iPhoneOS"],
                         CFBundleExecutable="SafeBoxPersonalStaging", NSFaceIDUsageDescription="Synthetic",
                         NSAppTransportSecurity={"NSAllowsArbitraryLoads": False})
        (self.app / "SafeBoxPersonalStaging").write_bytes(b"synthetic-test-not-a-Mach-O")
        (self.app / "PrivacyInfo.xcprivacy").write_bytes(b"synthetic")
        self.write_info()

    def write_info(self):
        with (self.app / "Info.plist").open("wb") as output:
            plistlib.dump(self.info, output)

    def test_expected_metadata_is_accepted(self):
        self.assertEqual(inspect_bundle(self.app)["SafeBoxEnvironment"], "staging")

    def test_other_backend_and_simulator_are_rejected(self):
        for key, value in [("SafeBoxBackendURL", "https://safebox-teal.vercel.app"),
                           ("CFBundleSupportedPlatforms", ["iPhoneSimulator"])]:
            with self.subTest(key=key):
                original = self.info[key]
                self.info[key] = value
                self.write_info()
                with self.assertRaises(ValueError):
                    inspect_bundle(self.app)
                self.info[key] = original

    def test_ats_exception_is_rejected(self):
        self.info["NSAppTransportSecurity"]["NSExceptionDomains"] = {"example.test": {}}
        self.write_info()
        with self.assertRaises(ValueError):
            inspect_bundle(self.app)

    def test_extensions_profiles_keys_and_envs_are_rejected(self):
        for name in ["AutoFill.appex", "embedded.mobileprovision", "private.p12", ".env.local", "main.entitlements"]:
            with self.subTest(name=name):
                item = self.app / name
                item.write_bytes(b"synthetic")
                with self.assertRaises(ValueError):
                    inspect_bundle(self.app)
                item.unlink()


if __name__ == "__main__":
    unittest.main()

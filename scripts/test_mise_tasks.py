"""Exercise the real mise argument parser and dispatch with disposable commands."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
MISE = shutil.which("mise")


@unittest.skipUnless(MISE, "mise is required for task workflow checks")
class MiseTaskTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="geo-planner-mise-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        # Use the repository tasks with no runtime downloads in the fixture.
        source = (ROOT / "mise.toml").read_text()
        (self.root / "mise.toml").write_text(source[source.index("[tasks.setup]"):])
        self.log = self.root / "commands.log"
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        stub = '''#!/bin/sh
line="$(basename "$0")"
for arg in "$@"; do line="$line $arg"; done
printf '%s\\n' "$line" >> "$TASK_TEST_LOG"
if [ "${TASK_TEST_FAIL:-}" = "$(basename "$0")" ]; then exit 17; fi
'''
        for command in ["npm", "python3", "node"]:
            path = bin_dir / command
            path.write_text(stub)
            path.chmod(0o755)
        for command in ["gradlew", "scripts/verify.sh"]:
            path = self.root / command
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(stub)
            path.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
            "MISE_TRUSTED_CONFIG_PATHS": str(self.root),
            "MISE_TASK_RUN_AUTO_INSTALL": "false",
            "MISE_AUTO_INSTALL": "false",
            "TASK_TEST_LOG": str(self.log),
        }
        for key in list(self.env):
            if key.startswith("usage_"):
                del self.env[key]

    def run_task(self, *args, success=True):
        result = subprocess.run(
            [MISE, "run", *args], cwd=self.root, env=self.env,
            text=True, capture_output=True, timeout=30,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def commands(self):
        return self.log.read_text().splitlines() if self.log.exists() else []

    def test_help_and_invalid_selectors_do_not_execute_commands(self):
        for task in ["start", "build"]:
            with self.subTest(task=task):
                result = self.run_task(task)
                self.assertIn("--all", result.stdout + result.stderr)
        for task in ["start", "build", "verify"]:
            self.run_task(task, "unknown", success=False)
            self.run_task(task, "frontend", "--all", success=False)
            self.run_task(task, "--help")
        self.assertEqual(self.commands(), [])

    def test_start_all_clears_parent_selectors_and_runs_every_service(self):
        self.run_task("start", "--all")
        self.assertCountEqual(self.commands(), [
            "npm --prefix frontend start",
            "gradlew :backend:bootRun --console=plain",
            "npm --prefix backend-simulator run build",
            "npm --prefix backend-simulator start",
            "npm --prefix frontend run storybook",
        ])

    def test_build_routes_individual_targets_and_all(self):
        expected = {
            "backend": "gradlew :backend:bootJar",
            "frontend": "npm --prefix frontend run build",
            "simulator": "npm --prefix backend-simulator run build",
            "storybook": "npm --prefix frontend run storybook:build",
        }
        for target, command in expected.items():
            self.log.unlink(missing_ok=True)
            self.run_task("build", target)
            self.assertEqual(self.commands(), [command])
        self.log.unlink()
        self.run_task("build", "--all")
        self.assertCountEqual(self.commands(), expected.values())

    def test_verify_targets_and_policy_compatibility(self):
        expected = {
            "backend": ["gradlew :backend:check"],
            "frontend": ["npm --prefix frontend run verify"],
            "simulator": ["npm --prefix backend-simulator run verify"],
            "legacy": ["verify.sh"],
            "requirements": [
                "python3 -m py_compile scripts/update_requirements_index.py scripts/test_update_requirements_index.py",
                "python3 -m unittest discover -s scripts -p test_update_requirements_index.py",
                "python3 scripts/update_requirements_index.py --check",
            ],
        }
        for target, commands in expected.items():
            self.log.unlink(missing_ok=True)
            self.run_task("verify", target)
            self.assertEqual(self.commands(), commands)
        all_commands = [item for items in expected.values() for item in items]
        all_commands.append("python3 -m unittest discover -s scripts -p test_mise_tasks.py")
        for args in [(), ("--all",)]:
            self.log.unlink()
            self.run_task("verify", *args)
            self.assertCountEqual(self.commands(), all_commands)
        self.log.unlink()
        self.run_task("verify-legacy")
        self.assertEqual(self.commands(), ["verify.sh"])

    def test_ci_uses_frozen_setup_and_stops_on_setup_failure(self):
        self.run_task("ci")
        self.assertEqual(self.commands()[:3], [
            "npm --prefix frontend ci",
            "npm --prefix backend-simulator ci",
            "npm --prefix frontend exec -- playwright install --with-deps chromium",
        ])
        self.assertIn("gradlew :backend:check", self.commands())
        self.log.unlink()
        self.env["TASK_TEST_FAIL"] = "npm"
        self.run_task("ci", success=False)
        self.assertEqual(self.commands(), ["npm --prefix frontend ci"])

    def test_local_setup_and_component_failures(self):
        self.run_task("setup")
        self.assertEqual(self.commands(), [
            "npm --prefix frontend install",
            "npm --prefix backend-simulator install",
            "npm --prefix frontend exec -- playwright install chromium",
        ])
        self.log.unlink()
        self.env["TASK_TEST_FAIL"] = "gradlew"
        self.run_task("build", "--all", success=False)
        self.assertEqual(self.commands(), ["gradlew :backend:bootJar"])
        self.log.unlink()
        self.run_task("verify", "--all", success=False)
        self.assertIn("gradlew :backend:check", self.commands())

    def test_legacy_gate_failure_reaches_verify_and_ci(self):
        self.env["TASK_TEST_FAIL"] = "verify.sh"
        for args in [("verify", "--all"), ("ci",)]:
            with self.subTest(args=args):
                self.log.unlink(missing_ok=True)
                self.run_task(*args, success=False)
                self.assertIn("verify.sh", self.commands())
                if args == ("ci",):
                    self.assertIn("npm --prefix frontend ci", self.commands())


if __name__ == "__main__":
    unittest.main()

"""Build hook: ships the repo-root app/ inside the wheel as aws_power_switch_cdk/app.

The app is the single source of truth and lives outside cdk/. A git install with
`#subdirectory=cdk` clones the whole repo and builds the wheel from cdk/, so ../app is
there at build time. Build the wheel straight from the source tree (`uv build --wheel`,
`pip install ./cdk`); an sdist would not contain ../app.
"""

from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

APP_DIR = Path(__file__).resolve().parent.parent / "app"
EXCLUDED_DIRS = {"tests", "dev"}
PACKAGE_APP_DIR = "aws_power_switch_cdk/app"


def app_files(app_dir: Path) -> dict[str, str]:
    """Maps each shipped app file to its path inside the wheel."""
    files = {}
    for path in sorted(app_dir.rglob("*")):
        relative = path.relative_to(app_dir)
        if path.is_file() and relative.parts[0] not in EXCLUDED_DIRS:
            files[str(path)] = f"{PACKAGE_APP_DIR}/{relative.as_posix()}"
    return files


class AppBundleHook(BuildHookInterface):
    def initialize(self, version, build_data):
        if not (APP_DIR / "index.mjs").is_file():
            raise FileNotFoundError(
                f"{APP_DIR}/index.mjs not found; build the wheel from a full checkout of the repo"
            )
        build_data["force_include"].update(app_files(APP_DIR))

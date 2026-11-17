from pathlib import Path

from aws_power_switch_cdk.app_source import APP_DIR

REPO_APP_DIR = Path(__file__).resolve().parents[2] / "app"


def files_under(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    }


def test_installed_package_ships_the_repo_app_without_tests_or_dev():
    expected = {
        name: content
        for name, content in files_under(REPO_APP_DIR).items()
        if name.split("/")[0] not in {"tests", "dev"}
    }

    assert "index.mjs" in expected
    assert files_under(APP_DIR) == expected

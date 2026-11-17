"""The synthesized template must match the checked-in snapshot.

After an intended change, regenerate it with UPDATE_SNAPSHOT=1 and commit it in the same PR.
"""

import json
import os
import re
from pathlib import Path

from stack import synth

SNAPSHOT = Path(__file__).parent / "snapshots" / "power_switch.template.json"
# The asset hash changes with every app edit; the bundle itself is covered by test_app_bundle.
ASSET_HASH = re.compile(r"\b[0-9a-f]{64}\b")


def normalized_template() -> str:
    rendered = json.dumps(synth().to_json(), indent=2, sort_keys=True) + "\n"
    return ASSET_HASH.sub("<asset-hash>", rendered)


def test_template_matches_snapshot():
    actual = normalized_template()
    if os.environ.get("UPDATE_SNAPSHOT") == "1":
        SNAPSHOT.write_text(actual)

    expected = SNAPSHOT.read_text() if SNAPSHOT.exists() else ""
    assert actual == expected, "template changed; rerun with UPDATE_SNAPSHOT=1 and commit the snapshot"

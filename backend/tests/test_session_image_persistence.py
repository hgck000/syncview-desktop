from __future__ import annotations

import base64
import io
import json
import os
import tempfile
import time
import unittest
from pathlib import Path

from PIL import Image

from backend.app.bridge import (
    Bridge,
    SESSION_IMAGE_CLEANUP_GRACE_SECONDS,
)


class SessionImagePersistenceTest(unittest.TestCase):
    def test_legacy_dataurl_is_migrated_to_exact_local_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app_data = Path(temp_dir) / "app-data"
            bridge = Bridge(app_data)

            encoded = io.BytesIO()
            Image.new("RGB", (20, 12), (90, 40, 180)).save(
                encoded,
                format="HEIF",
                quality=90,
            )
            original_bytes = encoded.getvalue()
            dataurl = (
                "data:application/octet-stream;base64,"
                + base64.b64encode(original_bytes).decode("ascii")
            )
            legacy_session = {
                "version": 1,
                "activeTabId": "tab-1",
                "tabs": [
                    {
                        "id": "tab-1",
                        "panes": ["A"],
                        "files": {},
                        "dataURL": {"A": dataurl},
                        "names": {"A": "camera.heic"},
                    }
                ],
            }
            session_path = app_data / "last_session.json"
            session_path.write_text(
                json.dumps(legacy_session),
                encoding="utf-8",
            )

            restored = bridge.read_last_session()
            self.assertIsNotNone(restored)
            restored_tab = restored["tabs"][0]
            persisted_path = Path(restored_tab["files"]["A"])

            self.assertEqual(restored_tab["dataURL"], {})
            self.assertEqual(persisted_path.suffix, ".heic")
            self.assertEqual(persisted_path.read_bytes(), original_bytes)
            self.assertNotIn(dataurl, session_path.read_text(encoding="utf-8"))

            # A fresh Bridge instance simulates the next app launch.
            restarted = Bridge(app_data).read_last_session()
            self.assertEqual(
                restarted["tabs"][0]["files"]["A"],
                str(persisted_path),
            )

            bridge.write_last_session(
                {
                    "version": 1,
                    "activeTabId": "tab-1",
                    "tabs": [
                        {
                            "id": "tab-1",
                            "panes": [],
                            "files": {},
                            "dataURL": {},
                        }
                    ],
                }
            )
            self.assertTrue(persisted_path.exists())

            expired = (
                time.time() - SESSION_IMAGE_CLEANUP_GRACE_SECONDS - 1
            )
            os.utime(persisted_path, (expired, expired))

            # Reimporting the same content reuses the same hash path but must
            # renew its grace period before the next autosave references it.
            reused_path = bridge.persist_image_dataurl(
                dataurl,
                "camera.heic",
            )
            self.assertEqual(reused_path, str(persisted_path))
            bridge.write_last_session(
                {
                    "version": 1,
                    "activeTabId": "tab-1",
                    "tabs": [
                        {
                            "id": "tab-1",
                            "panes": [],
                            "files": {},
                            "dataURL": {},
                        }
                    ],
                }
            )
            self.assertTrue(persisted_path.exists())

            os.utime(persisted_path, (expired, expired))
            bridge.write_last_session(
                {
                    "version": 1,
                    "activeTabId": "tab-1",
                    "tabs": [
                        {
                            "id": "tab-1",
                            "panes": [],
                            "files": {},
                            "dataURL": {},
                        }
                    ],
                }
            )
            self.assertFalse(persisted_path.exists())


if __name__ == "__main__":
    unittest.main()

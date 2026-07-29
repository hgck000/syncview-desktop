from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from backend.app import main


class PersistentMediaCacheTest(unittest.TestCase):
    def test_decoded_heic_is_reused_without_decoding_again(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_path = root / "camera.heic"
            cache_dir = root / "media-cache"
            cache_dir.mkdir()

            Image.new("RGB", (24, 16), (20, 80, 160)).save(
                source_path,
                format="HEIF",
                quality=90,
            )

            with patch.object(main, "MEDIA_CACHE_DIR", cache_dir):
                first = main.ensure_decoded_image(source_path)
                self.assertTrue(first.is_file())

                # A new request (and, equivalently, a new app launch using the
                # same directory) must use the existing lossless PNG.
                with patch.object(
                    main.Image,
                    "open",
                    side_effect=AssertionError("HEIC decoded twice"),
                ):
                    second = main.ensure_decoded_image(source_path)

            self.assertEqual(first, second)

    def test_cache_pruning_keeps_the_current_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_dir = Path(temp_dir)
            old_file = cache_dir / "old.png"
            current_file = cache_dir / "current.png"
            old_file.write_bytes(b"a" * 16)
            current_file.write_bytes(b"b" * 16)

            with (
                patch.object(main, "MEDIA_CACHE_DIR", cache_dir),
                patch.object(main, "MEDIA_CACHE_MAX_BYTES", 16),
            ):
                main.prune_media_cache(exclude={current_file})

            self.assertFalse(old_file.exists())
            self.assertTrue(current_file.exists())

    def test_cache_pruning_does_not_remove_an_active_response(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_path = root / "camera.heic"
            cache_dir = root / "media-cache"
            cache_dir.mkdir()
            Image.new("RGB", (24, 16), (30, 100, 170)).save(
                source_path,
                format="HEIF",
                quality=90,
            )

            with (
                patch.object(main, "MEDIA_CACHE_DIR", cache_dir),
                patch.object(main, "MEDIA_CACHE_MAX_BYTES", 1),
            ):
                active_file = main.ensure_decoded_image(
                    source_path,
                    mark_active=True,
                )
                main.prune_media_cache()
                self.assertTrue(active_file.exists())

                main._release_cache_response(active_file)
                self.assertFalse(active_file.exists())


if __name__ == "__main__":
    unittest.main()

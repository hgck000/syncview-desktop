from __future__ import annotations

import base64
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException
from PIL import Image

from backend.app.bridge import Bridge
from backend.app.main import serve_local_image


class HeicSupportTest(unittest.TestCase):
    def test_heic_image_thumbnail_and_exif_pipeline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = Path(temp_dir) / "camera-sample.heic"

            image = Image.new("RGB", (12, 8), (32, 96, 192))
            exif = Image.Exif()
            exif[271] = "SyncView"
            exif[272] = "HEIC Test Camera"
            image.save(image_path, format="HEIF", quality=90, exif=exif)

            bridge = Bridge(Path(temp_dir) / "app-data")

            image_data_url = bridge.read_image_dataurl(str(image_path))
            self.assertIsNotNone(image_data_url)
            self.assertTrue(image_data_url.startswith("data:image/png;base64,"))

            encoded_png = image_data_url.split(",", 1)[1]
            with Image.open(io.BytesIO(base64.b64decode(encoded_png))) as decoded:
                self.assertEqual(decoded.size, (12, 8))

            thumbnail_data_url = bridge.read_image_thumbnail(
                str(image_path),
                max_width=64,
                max_height=64,
            )
            self.assertIsNotNone(thumbnail_data_url)
            self.assertTrue(
                thumbnail_data_url.startswith("data:image/jpeg;base64,")
            )

            exif_data = bridge.read_exif_from_path(str(image_path))
            self.assertIsNotNone(exif_data)
            self.assertEqual(exif_data.get("Make"), "SyncView")
            self.assertEqual(exif_data.get("Model"), "HEIC Test Camera")
            self.assertEqual(exif_data.get("ImageWidth"), 12)
            self.assertEqual(exif_data.get("ImageHeight"), 8)

            with patch.dict(
                os.environ,
                {
                    "SYNCVIEW_MEDIA_TOKEN": "test-media-token",
                },
            ):
                media_bridge = Bridge(Path(temp_dir) / "media-data")
                media_url = media_bridge.get_image_url(str(image_path))

                dropped_data_url = (
                    "data:application/octet-stream;base64,"
                    + base64.b64encode(image_path.read_bytes()).decode("ascii")
                )
                staged_url = media_bridge.stage_image_dataurl(dropped_data_url)
                self.assertIsNotNone(staged_url)
                self.assertEqual(
                    staged_url,
                    media_bridge.stage_image_dataurl(dropped_data_url),
                )

            self.assertIsNotNone(media_url)
            parsed_url = urlparse(media_url)
            self.assertFalse(parsed_url.scheme)
            self.assertFalse(parsed_url.netloc)
            query = parse_qs(parsed_url.query)
            self.assertEqual(parsed_url.path, "/api/image")
            self.assertEqual(query["token"], ["test-media-token"])
            self.assertEqual(query["path"], [str(image_path.resolve())])

            parsed_staged_url = urlparse(staged_url)
            staged_query = parse_qs(parsed_staged_url.query)
            staged_path = Path(staged_query["path"][0])
            self.assertEqual(parsed_staged_url.path, "/api/image")
            self.assertEqual(staged_query["token"], ["test-media-token"])
            self.assertEqual(staged_path.suffix, ".png")
            self.assertTrue(staged_path.is_file())

            with patch.dict(
                os.environ,
                {"SYNCVIEW_MEDIA_TOKEN": "test-media-token"},
            ):
                response = serve_local_image(
                    str(image_path),
                    "test-media-token",
                )
                with Image.open(response.path) as served:
                    self.assertEqual(served.size, (12, 8))
                    self.assertEqual(served.format, "PNG")
                    self.assertEqual(served.mode, "RGB")

                staged_response = serve_local_image(
                    str(staged_path),
                    "test-media-token",
                )
                with Image.open(staged_response.path) as staged:
                    self.assertEqual(staged.size, (12, 8))
                    self.assertEqual(staged.format, "PNG")
                    self.assertEqual(staged.mode, "RGB")

                with self.assertRaises(HTTPException) as denied:
                    serve_local_image(str(image_path), "wrong-token")
                self.assertEqual(denied.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()

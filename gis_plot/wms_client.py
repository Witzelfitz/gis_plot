"""WMS client for the Swiss Federal Geoportal (wms.geo.admin.ch)."""

from __future__ import annotations

import io
from typing import Any

from owslib.wms import WebMapService
from PIL import Image

WMS_URL = "https://wms.geo.admin.ch/"
WMS_VERSION = "1.3.0"
DEFAULT_CRS = "EPSG:2056"
DEFAULT_FORMAT = "image/png"

# geo.admin.ch typically caps GetMap at 2048 px per side
_MAX_TILE_PX = 2048


class WMSClient:
    def __init__(self, url: str = WMS_URL) -> None:
        self._wms = WebMapService(url, version=WMS_VERSION)

    # ------------------------------------------------------------------
    # Layer listing
    # ------------------------------------------------------------------

    def list_layers(self) -> list[dict[str, str]]:
        """Return all available layers as a list of dicts."""
        result = []
        for layer_id, layer in self._wms.contents.items():
            result.append(
                {
                    "id": layer_id,
                    "title": layer.title or layer_id,
                    "abstract": (layer.abstract or "").strip(),
                }
            )
        return sorted(result, key=lambda x: x["title"].lower())

    # ------------------------------------------------------------------
    # Map fetching
    # ------------------------------------------------------------------

    def get_map_image(
        self,
        layers: list[str],
        bbox: tuple[float, float, float, float],
        crs: str = DEFAULT_CRS,
        width: int = 1024,
        height: int = 1448,
    ) -> Image.Image:
        """Fetch a map image from the WMS service.

        If the requested size exceeds _MAX_TILE_PX in either dimension the
        image is assembled from tiles and stitched together.
        """
        if width <= _MAX_TILE_PX and height <= _MAX_TILE_PX:
            return self._fetch_tile(layers, bbox, crs, width, height)

        return self._fetch_tiled(layers, bbox, crs, width, height)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fetch_tile(
        self,
        layers: list[str],
        bbox: tuple[float, float, float, float],
        crs: str,
        width: int,
        height: int,
    ) -> Image.Image:
        response = self._wms.getmap(
            layers=layers,
            srs=crs,
            bbox=bbox,
            size=(width, height),
            format=DEFAULT_FORMAT,
            transparent=False,
        )
        return Image.open(io.BytesIO(response.read())).convert("RGB")

    def _fetch_tiled(
        self,
        layers: list[str],
        bbox: tuple[float, float, float, float],
        crs: str,
        width: int,
        height: int,
    ) -> Image.Image:
        """Tile the request into _MAX_TILE_PX × _MAX_TILE_PX chunks."""
        cols = -(-width // _MAX_TILE_PX)   # ceiling division
        rows = -(-height // _MAX_TILE_PX)

        xmin, ymin, xmax, ymax = bbox
        x_span = xmax - xmin
        y_span = ymax - ymin

        canvas = Image.new("RGB", (width, height))

        for row in range(rows):
            for col in range(cols):
                # pixel slice
                px0 = col * _MAX_TILE_PX
                py0 = row * _MAX_TILE_PX
                px1 = min(px0 + _MAX_TILE_PX, width)
                py1 = min(py0 + _MAX_TILE_PX, height)
                tw = px1 - px0
                th = py1 - py0

                # geographic slice (note: image y-axis is flipped vs geo)
                tx_min = xmin + (px0 / width) * x_span
                tx_max = xmin + (px1 / width) * x_span
                # row 0 is top of image → ymax side
                ty_max = ymax - (py0 / height) * y_span
                ty_min = ymax - (py1 / height) * y_span

                tile = self._fetch_tile(
                    layers, (tx_min, ty_min, tx_max, ty_max), crs, tw, th
                )
                canvas.paste(tile, (px0, py0))

        return canvas


def get_client() -> WMSClient:
    """Return a module-level singleton WMSClient."""
    global _client  # noqa: PLW0603
    if "_client" not in globals():
        _client = WMSClient()
    return _client

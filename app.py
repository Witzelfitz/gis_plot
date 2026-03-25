"""Flask web application for gis_plot."""

from __future__ import annotations

import logging

from flask import Flask, Response, jsonify, render_template, request

from gis_plot.pdf_export import export_pdf_bytes
from gis_plot.renderer import A0_HEIGHT_MM, A0_WIDTH_MM, DPI, render_a0
from gis_plot.wms_client import DEFAULT_CRS, WMSClient

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Module-level client — initialised lazily on first use so the server starts
# even when offline (error only surfaces when a request hits the WMS).
_wms_client: WMSClient | None = None


def _get_client() -> WMSClient:
    global _wms_client
    if _wms_client is None:
        _wms_client = WMSClient()
    return _wms_client


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/layers")
def list_layers():
    try:
        layers = _get_client().list_layers()
        return jsonify(layers)
    except Exception as exc:
        log.exception("Failed to fetch WMS layers")
        return jsonify({"error": str(exc)}), 502


@app.post("/api/generate")
def generate_pdf():
    """Generate and stream an A0 PDF.

    Expected JSON body::

        {
            "layers": ["ch.babs.kulturgueter"],
            "bbox": [2480000, 1070000, 2840000, 1300000],
            "crs": "EPSG:2056",
            "title": "Zivilschutz Karte"
        }
    """
    data = request.get_json(force=True)

    layers: list[str] = data.get("layers") or []
    bbox: list[float] = data.get("bbox") or []
    crs: str = data.get("crs", DEFAULT_CRS)
    title: str = data.get("title", "Zivilschutz Karte")

    if not layers:
        return jsonify({"error": "At least one layer must be specified"}), 400
    if len(bbox) != 4:
        return jsonify({"error": "bbox must be [xmin, ymin, xmax, ymax]"}), 400

    try:
        # Compute pixel dimensions for A0 at configured DPI
        width_px = round((A0_WIDTH_MM / 25.4) * DPI)
        height_px = round((A0_HEIGHT_MM / 25.4) * DPI)

        log.info(
            "Fetching WMS map: layers=%s bbox=%s size=%dx%d",
            layers,
            bbox,
            width_px,
            height_px,
        )
        map_image = _get_client().get_map_image(
            layers=layers,
            bbox=tuple(bbox),  # type: ignore[arg-type]
            crs=crs,
            width=width_px,
            height=height_px,
        )

        log.info("Rendering A0 figure …")
        fig = render_a0(
            map_image=map_image,
            title=title,
            bbox=tuple(bbox),  # type: ignore[arg-type]
            crs=crs,
        )

        log.info("Exporting PDF …")
        pdf_bytes = export_pdf_bytes(fig)

        safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
        filename = f"{safe_title.strip().replace(' ', '_')}.pdf"

        return Response(
            pdf_bytes,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except Exception as exc:
        log.exception("PDF generation failed")
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

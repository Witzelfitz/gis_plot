"""
example.py — generate an A0 PDF for a Zivilschutz map.

Run:
    python example.py

Requires internet access to wms.geo.admin.ch.
The output file is written to the current directory.
"""

from gis_plot.wms_client import WMSClient
from gis_plot.renderer import render_a0
from gis_plot.pdf_export import export_pdf

# ---------------------------------------------------------------------------
# Configuration — adjust as needed
# ---------------------------------------------------------------------------

# One or more layer IDs from wms.geo.admin.ch.
# Uncomment list_layers() below to browse all available layers.
LAYERS = [
    "ch.swisstopo.pixelkarte-farbe",   # base map (coloured)
    "ch.babs.kulturgueter",            # Kulturgüter / cultural heritage sites
]

# Map extent in LV95 / EPSG:2056 (xmin, ymin, xmax, ymax).
# This example covers the whole of Switzerland.
BBOX = (2480000, 1070000, 2840000, 1300000)

TITLE = "Zivilschutz – Kulturgüter Schweiz"
OUTPUT = "zivilschutz_kulturgueter.pdf"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    client = WMSClient()

    # Optional: print all available layer IDs and titles
    # layers = client.list_layers()
    # for layer in layers:
    #     print(f"{layer['id']:60s}  {layer['title']}")

    print(f"Fetching map ({BBOX}) …")
    image = client.get_map_image(layers=LAYERS, bbox=BBOX)

    print("Rendering A0 figure …")
    fig = render_a0(image, title=TITLE, bbox=BBOX)

    print(f"Exporting PDF → {OUTPUT} …")
    export_pdf(fig, OUTPUT)

    print(f"Done. Open {OUTPUT!r} in any PDF viewer.")


if __name__ == "__main__":
    main()

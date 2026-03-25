# gis_plot

Local web application for printing **Zivilschutz GIS maps** from the Swiss Federal Geoportal ([map.geo.admin.ch](https://map.geo.admin.ch)) as print-ready **A0 PDFs** (841 × 1189 mm).

---

## Features

- Browse all WMS layers available on `wms.geo.admin.ch`
- Select one or more layers and define a map extent in Swiss LV95 (EPSG:2056)
- Generates an A0 PDF with title block, north arrow, and scale bar
- Runs entirely locally — no data leaves your machine

---

## Requirements

- Python 3.10+
- Internet access to `wms.geo.admin.ch`

---

## Installation

```bash
git clone https://github.com/GentleBillow/gis_plot.git
cd gis_plot
pip install -r requirements.txt
```

---

## Usage

### Web app (recommended)

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

1. Wait for the layer list to load (fetched live from geo.admin.ch)
2. Select one or more WMS layers (Ctrl/⌘ for multi-select)
3. Enter the map extent as LV95 coordinates (xmin, ymin, xmax, ymax)
4. Enter a title
5. Click **PDF generieren** — the PDF downloads automatically

### Python API

```python
from gis_plot.wms_client import WMSClient
from gis_plot.renderer import render_a0
from gis_plot.pdf_export import export_pdf

client = WMSClient()

# 1. List available layers
layers = client.list_layers()
print(layers[0])  # {'id': '...', 'title': '...', 'abstract': '...'}

# 2. Fetch map image (LV95 bbox around Bern)
bbox = (2590000, 1195000, 2610000, 1210000)
image = client.get_map_image(
    layers=["ch.swisstopo.pixelkarte-farbe"],
    bbox=bbox,
)

# 3. Render to A0 figure
fig = render_a0(image, title="Kanton Bern", bbox=bbox)

# 4. Export to PDF
export_pdf(fig, "kanton_bern.pdf")
```

See [`example.py`](example.py) for a ready-to-run script.

---

## API reference

### `GET /api/layers`

Returns a JSON array of all available WMS layers.

```json
[
  { "id": "ch.babs.kulturgueter", "title": "Kulturgüter", "abstract": "..." },
  ...
]
```

### `POST /api/generate`

Generates and streams an A0 PDF.

**Request body:**

```json
{
  "layers": ["ch.babs.kulturgueter"],
  "bbox": [2480000, 1070000, 2840000, 1300000],
  "crs": "EPSG:2056",
  "title": "Zivilschutz Übersicht Schweiz"
}
```

| Field | Type | Description |
|---|---|---|
| `layers` | `string[]` | One or more WMS layer IDs (required) |
| `bbox` | `number[4]` | `[xmin, ymin, xmax, ymax]` in `crs` units (required) |
| `crs` | `string` | Coordinate reference system (default: `EPSG:2056`) |
| `title` | `string` | Title printed on the map (default: `Zivilschutz Karte`) |

**Response:** `application/pdf` file download.

---

## Default bounding boxes (LV95 / EPSG:2056)

| Area | xmin | ymin | xmax | ymax |
|---|---|---|---|---|
| Whole Switzerland | 2480000 | 1070000 | 2840000 | 1300000 |
| Bern (city) | 2590000 | 1195000 | 2610000 | 1210000 |
| Zürich (city) | 2676000 | 1240000 | 2690000 | 1252000 |
| Geneva (city) | 2492000 | 1113000 | 2506000 | 1123000 |

---

## Data source

Map data © [swisstopo](https://www.swisstopo.admin.ch/) via [wms.geo.admin.ch](https://wms.geo.admin.ch/).
Usage is free for public geodata. See [geo.admin.ch terms of use](https://www.geo.admin.ch/en/geo-services/geo-services/terms-of-use.html).

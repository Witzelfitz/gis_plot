# gis_plot

Local web application for printing **Zivilschutz GIS maps** from the Swiss Federal Geoportal ([map.geo.admin.ch](https://map.geo.admin.ch)) as print-ready **A0 landscape PDFs** (1189 × 841 mm).

---

## Features

- Browse all WMS layers available on `wms.geo.admin.ch`
- Choose the print extent interactively on a Leaflet map with an OpenStreetMap background
- Keep the print frame fixed to the A0 landscape aspect ratio and rotate it as needed
- Keep frequently used Zivilschutz layers pinned at the top of the selection
- Select one or more layers and define a map extent in Swiss LV95 (EPSG:2056)
- Generates an A0 PDF with title block, north arrow, and scale bar
- Runs entirely locally — no data leaves your machine

---

## Requirements

- Node.js 18+
- Internet access to `wms.geo.admin.ch`

---

## Installation

```bash
git clone https://github.com/GentleBillow/gis_plot.git
cd gis_plot
npm install
```

---

## Usage

### Web app (recommended)

```bash
npm start
```

Open [http://localhost:1726](http://localhost:1726) in your browser.

1. Wait for the layer list to load (fetched live from geo.admin.ch)
2. Draw the desired extent on the Leaflet map, move the center marker, or übernehmen the current map view
3. Select one or more WMS layers (Ctrl/⌘ for multi-select); common Zivilschutz layers are pinned at the top
4. Adjust rotation or frame size if needed, then enter a title
5. Click **PDF generieren** — the PDF downloads automatically

The complete application stack now runs in Node.js: Express routes, request validation middleware, WMS access, tile stitching, and A0 PDF rendering.

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
  "printArea": {
    "centerX": 2660000,
    "centerY": 1185000,
    "width": 22000,
    "height": 15563.5,
    "rotationDeg": 25
  },
  "crs": "EPSG:2056",
  "title": "Zivilschutz Übersicht Schweiz"
}
```

| Field | Type | Description |
|---|---|---|
| `layers` | `string[]` | One or more WMS layer IDs (required) |
| `bbox` | `number[4]` | Axis-aligned bounding box in `crs` units (required for compatibility; UI sends it automatically) |
| `printArea` | `object` | Fixed A0 landscape frame with `centerX`, `centerY`, `width`, `height`, `rotationDeg` |
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

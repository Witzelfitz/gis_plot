/* gis_plot frontend */

const SWITZERLAND_BBOX = [2480000, 1070000, 2840000, 1300000];
const INITIAL_SELECTION_BBOX = [2744250, 1252716, 2746520, 1255623];
const A0_LANDSCAPE_RATIO = 1189 / 841;
const MIN_FRAME_WIDTH_M = 1000;
const DEFAULT_SELECTED_LAYER_IDS = ['ch.swisstopo.pixelkarte-farbe'];
const RECOMMENDED_LAYER_IDS = [
  'ch.swisstopo.pixelkarte-farbe',
  'ch.swisstopo.swisstlm3d-karte-farbe',
  'ch.babs.kulturgueter',
  'ch.ensi.zonenplan-notfallschutz-kernanlagen',
  'ch.bakom.notruf-112_zentral',
  'ch.bakom.notruf-117_zentral',
  'ch.bakom.notruf-118_zentral',
  'ch.bakom.notruf-144_zentral',
];
const LV95_PROJ = '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs';

const layersSelect = document.getElementById('layers');
const layerFilterInput = document.getElementById('layer-filter');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');
const useViewBtn = document.getElementById('use-view-btn');
const resetExtentBtn = document.getElementById('reset-extent-btn');
const shrinkFrameBtn = document.getElementById('shrink-frame-btn');
const growFrameBtn = document.getElementById('grow-frame-btn');
const selectionSummaryEl = document.getElementById('selection-summary');
const frameInputs = {
  centerX: document.getElementById('center-x'),
  centerY: document.getElementById('center-y'),
  width: document.getElementById('frame-width'),
  height: document.getElementById('frame-height'),
};

let availableLayers = [];
let initialLayerSelectionDone = false;
let selectedLayerIds = new Set();
let selection = null;
let map;
let selectionRectangle;
let selectionCenterMarker;
let selectionCornerMarkers = [];

proj4.defs('EPSG:2056', LV95_PROJ);

initMap();
attachEvents();
loadLayers();

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

function initMap() {
  map = L.map('map', {
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap-Mitwirkende',
  }).addTo(map);

  const drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: {
      polyline: false,
      polygon: false,
      circle: false,
      marker: false,
      circlemarker: false,
      rectangle: {
        shapeOptions: {
          color: '#2f80ed',
          weight: 1.5,
          dashArray: '6 4',
        },
      },
    },
    edit: false,
  });

  map.addControl(drawControl);
  map.on(L.Draw.Event.CREATED, event => {
    const drawnBbox = boundsToBbox(event.layer.getBounds());
    selection = createSelectionFromBbox(drawnBbox, {
      mode: 'cover',
    });
    renderSelection({ fitMap: false });
  });

  selection = createSelectionFromBbox(INITIAL_SELECTION_BBOX, {
    mode: 'cover',
  });
  renderSelection({ fitMap: true });
}

// ---------------------------------------------------------------------------
// Load and render layers
// ---------------------------------------------------------------------------

async function loadLayers() {
  setStatus('', 'Lade verfügbare WMS-Layer ...');
  try {
    const res = await fetch('/api/layers');
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    availableLayers = data;
    renderLayerOptions();
    setStatus('ok', `${data.length} Layer geladen. Empfohlene ZS-Layer stehen oben.`);
  } catch (err) {
    setStatus('error', `Fehler beim Laden der Layer: ${err.message}`);
  }
}

function renderLayerOptions() {
  const query = layerFilterInput.value.trim().toLowerCase();

  if (!initialLayerSelectionDone && selectedLayerIds.size === 0) {
    DEFAULT_SELECTED_LAYER_IDS.forEach(id => selectedLayerIds.add(id));
    initialLayerSelectionDone = true;
  }

  const filteredLayers = availableLayers.filter(layer => {
    if (!query) {
      return true;
    }

    return `${layer.title} ${layer.id} ${layer.abstract}`.toLowerCase().includes(query);
  });

  const recommendedLayers = [];
  const otherLayers = [];
  const recommendedSet = new Set(RECOMMENDED_LAYER_IDS);

  filteredLayers.forEach(layer => {
    if (isPinnedTopLayer(layer) || recommendedSet.has(layer.id)) {
      recommendedLayers.push(layer);
    } else {
      otherLayers.push(layer);
    }
  });

  recommendedLayers.sort(compareRecommendedLayers);
  otherLayers.sort((left, right) => left.title.localeCompare(right.title, 'de', { sensitivity: 'base' }));

  layersSelect.innerHTML = '';

  if (recommendedLayers.length > 0) {
    layersSelect.appendChild(buildGroup('Empfohlen für Zivilschutz', recommendedLayers, selectedLayerIds));
  }

  if (otherLayers.length > 0) {
    layersSelect.appendChild(buildGroup(query ? 'Weitere Treffer' : 'Alle Layer', otherLayers, selectedLayerIds));
  }

  if (recommendedLayers.length === 0 && otherLayers.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = 'Keine Layer für diese Suche gefunden';
    layersSelect.appendChild(opt);
  }
}

function buildGroup(label, layers, selectedIds) {
  const group = document.createElement('optgroup');
  group.label = label;

  layers.forEach(layer => {
    const opt = document.createElement('option');
    opt.value = layer.id;
    opt.textContent = `${layer.title || layer.id} (${layer.id})`;
    opt.title = layer.abstract || '';
    opt.selected = selectedIds.has(layer.id);
    group.appendChild(opt);
  });

  return group;
}

function isPinnedTopLayer(layer) {
  return /^Landeskarte(n)?\b/i.test(layer.title || '');
}

function compareRecommendedLayers(left, right) {
  const leftPinned = isPinnedTopLayer(left);
  const rightPinned = isPinnedTopLayer(right);

  if (leftPinned && !rightPinned) {
    return -1;
  }
  if (!leftPinned && rightPinned) {
    return 1;
  }

  const leftIndex = RECOMMENDED_LAYER_IDS.indexOf(left.id);
  const rightIndex = RECOMMENDED_LAYER_IDS.indexOf(right.id);

  if (leftIndex !== -1 && rightIndex !== -1) {
    return leftIndex - rightIndex;
  }
  if (leftIndex !== -1) {
    return -1;
  }
  if (rightIndex !== -1) {
    return 1;
  }

  return left.title.localeCompare(right.title, 'de', { sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Selection handling
// ---------------------------------------------------------------------------

function attachEvents() {
  layerFilterInput.addEventListener('input', () => {
    renderLayerOptions();
  });

  layersSelect.addEventListener('change', () => {
    syncSelectedLayersFromDom();
  });

  frameInputs.centerX.addEventListener('change', applySelectionInputs);
  frameInputs.centerY.addEventListener('change', applySelectionInputs);
  frameInputs.width.addEventListener('change', applySelectionInputs);

  useViewBtn.addEventListener('click', () => {
    selection = createSelectionFromBbox(boundsToBbox(map.getBounds()), {
      mode: 'fit',
    });
    renderSelection({ fitMap: false });
  });

  resetExtentBtn.addEventListener('click', () => {
    selection = createSelectionFromBbox(SWITZERLAND_BBOX, {
      mode: 'fit',
    });
    renderSelection({ fitMap: true });
  });

  shrinkFrameBtn.addEventListener('click', () => {
    scaleSelection(0.9);
  });

  growFrameBtn.addEventListener('click', () => {
    scaleSelection(1.1);
  });

  generateBtn.addEventListener('click', generatePdf);
}

function applySelectionInputs() {
  const centerX = Number(frameInputs.centerX.value);
  const centerY = Number(frameInputs.centerY.value);
  const width = Number(frameInputs.width.value);

  if ([centerX, centerY, width].some(value => Number.isNaN(value) || !Number.isFinite(value))) {
    return;
  }

  selection = {
    centerX,
    centerY,
    width: Math.max(MIN_FRAME_WIDTH_M, width),
    height: Math.max(MIN_FRAME_WIDTH_M, width) / A0_LANDSCAPE_RATIO,
    rotationDeg: 0,
  };
  renderSelection({ fitMap: false });
}

function scaleSelection(factor) {
  selection = {
    ...selection,
    width: Math.max(MIN_FRAME_WIDTH_M, selection.width * factor),
  };
  selection.height = selection.width / A0_LANDSCAPE_RATIO;
  renderSelection({ fitMap: false });
}

function createSelectionFromBbox(bbox, options = {}) {
  const mode = options.mode || 'fit';
  const bboxWidth = bbox[2] - bbox[0];
  const bboxHeight = bbox[3] - bbox[1];
  const candidateWidth = mode === 'cover'
    ? Math.max(bboxWidth, bboxHeight * A0_LANDSCAPE_RATIO)
    : Math.min(bboxWidth, bboxHeight * A0_LANDSCAPE_RATIO);

  const width = Math.max(MIN_FRAME_WIDTH_M, candidateWidth);

  return {
    centerX: (bbox[0] + bbox[2]) / 2,
    centerY: (bbox[1] + bbox[3]) / 2,
    width,
    height: width / A0_LANDSCAPE_RATIO,
    rotationDeg: 0,
  };
}

function getSelectionCorners(selectionState) {
  const halfWidth = selectionState.width / 2;
  const halfHeight = selectionState.height / 2;
  return [
    [selectionState.centerX - halfWidth, selectionState.centerY + halfHeight],
    [selectionState.centerX + halfWidth, selectionState.centerY + halfHeight],
    [selectionState.centerX + halfWidth, selectionState.centerY - halfHeight],
    [selectionState.centerX - halfWidth, selectionState.centerY - halfHeight],
  ];
}

function getSelectionBoundingBbox(selectionState) {
  const corners = getSelectionCorners(selectionState);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);

  return [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
}

function renderSelection(options = {}) {
  const bbox = getSelectionBoundingBbox(selection);
  const bounds = bboxToLeafletBounds(bbox);
  const latLngs = [
    bounds.getNorthWest(),
    bounds.getNorthEast(),
    bounds.getSouthEast(),
    bounds.getSouthWest(),
  ];

  if (!selectionRectangle) {
    selectionRectangle = L.rectangle(bounds, {
      color: '#0a5bc4',
      weight: 2,
      fillColor: '#0a5bc4',
      fillOpacity: 0.08,
      dashArray: '8 6',
    }).addTo(map);
  } else {
    selectionRectangle.setBounds(bounds);
  }

  const centerLatLng = lv95ToLatLng(selection.centerX, selection.centerY);
  if (!selectionCenterMarker) {
    selectionCenterMarker = L.marker(centerLatLng, {
      draggable: true,
      icon: createHandleIcon('center-handle'),
      title: 'Druckrahmen verschieben',
    }).addTo(map);

    selectionCenterMarker.on('drag', event => {
      const [centerX, centerY] = latLngToLv95(event.target.getLatLng());
      selection.centerX = centerX;
      selection.centerY = centerY;
      renderSelection({ fitMap: false });
    });
  } else {
    selectionCenterMarker.setLatLng(centerLatLng);
  }

  renderCornerHandles(latLngs);

  updateSelectionInputs();

  if (options.fitMap) {
    map.fitBounds(bounds.pad(0.35));
  }
}

function updateSelectionInputs() {
  frameInputs.centerX.value = Math.round(selection.centerX);
  frameInputs.centerY.value = Math.round(selection.centerY);
  frameInputs.width.value = Math.round(selection.width);
  frameInputs.height.value = Math.round(selection.height);

  const bbox = getSelectionBoundingBbox(selection).map(value => Math.round(value));
  selectionSummaryEl.textContent = `A0 quer fixiert 1189:841 | BBox ${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}`;
}

function renderCornerHandles(latLngs) {
  latLngs.forEach((latLng, index) => {
    if (!selectionCornerMarkers[index]) {
      const marker = L.marker(latLng, {
        draggable: true,
        icon: createHandleIcon('corner-handle'),
        title: 'Rahmenecke anpassen',
      }).addTo(map);

      marker.on('drag', event => {
        updateSelectionFromCornerDrag(index, event.target.getLatLng());
      });

      selectionCornerMarkers[index] = marker;
      return;
    }

    selectionCornerMarkers[index].setLatLng(latLng);
  });
}

function updateSelectionFromCornerDrag(cornerIndex, latLng) {
  const bbox = getSelectionBoundingBbox(selection);
  const corners = [
    [bbox[0], bbox[3]],
    [bbox[2], bbox[3]],
    [bbox[2], bbox[1]],
    [bbox[0], bbox[1]],
  ];
  const oppositeIndex = (cornerIndex + 2) % 4;
  const oppositeCorner = corners[oppositeIndex];
  const [draggedX, draggedY] = latLngToLv95(latLng);
  const deltaX = draggedX - oppositeCorner[0];
  const deltaY = draggedY - oppositeCorner[1];
  const nextWidth = Math.max(
    MIN_FRAME_WIDTH_M,
    Math.abs(deltaX),
    Math.abs(deltaY) * A0_LANDSCAPE_RATIO,
  );
  const nextHeight = nextWidth / A0_LANDSCAPE_RATIO;
  const cornerSigns = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const [signX, signY] = cornerSigns[cornerIndex];
  const exactCornerX = oppositeCorner[0] + (signX * nextWidth);
  const exactCornerY = oppositeCorner[1] + (signY * nextHeight);

  selection = {
    ...selection,
    centerX: (oppositeCorner[0] + exactCornerX) / 2,
    centerY: (oppositeCorner[1] + exactCornerY) / 2,
    width: nextWidth,
    height: nextHeight,
  };

  renderSelection({ fitMap: false });
}

// ---------------------------------------------------------------------------
// Generate PDF
// ---------------------------------------------------------------------------

async function generatePdf() {
  syncSelectedLayersFromDom();

  const selectedLayers = Array.from(selectedLayerIds);
  if (selectedLayers.length === 0) {
    setStatus('error', 'Bitte mindestens einen Layer auswählen.');
    return;
  }

  const title = document.getElementById('title').value.trim();
  const bbox = getSelectionBoundingBbox(selection).map(value => Math.round(value));

  generateBtn.disabled = true;
  setStatus('', '<span class="spinner"></span>PDF wird generiert - dies kann 30-60 Sekunden dauern ...');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layers: selectedLayers,
        bbox,
        printArea: {
          centerX: selection.centerX,
          centerY: selection.centerY,
          width: selection.width,
          height: selection.height,
          rotationDeg: 0,
        },
        crs: 'EPSG:2056',
        title,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const nameMatch = contentDisposition.match(/filename="([^"]+)"/);
    anchor.href = url;
    anchor.download = nameMatch ? nameMatch[1] : 'karte.pdf';
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus('ok', 'PDF erfolgreich generiert und heruntergeladen.');
  } catch (err) {
    setStatus('error', `Fehler: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(cls, html) {
  statusEl.className = cls;
  statusEl.innerHTML = html;
}

function syncSelectedLayersFromDom() {
  const visibleIds = new Set(
    Array.from(layersSelect.querySelectorAll('option[value]')).map(option => option.value),
  );

  visibleIds.forEach(id => selectedLayerIds.delete(id));
  Array.from(layersSelect.selectedOptions).forEach(option => selectedLayerIds.add(option.value));
}

function lv95ToLatLng(x, y) {
  const [lng, lat] = proj4('EPSG:2056', 'EPSG:4326', [x, y]);
  return L.latLng(lat, lng);
}

function latLngToLv95(latLng) {
  const [x, y] = proj4('EPSG:4326', 'EPSG:2056', [latLng.lng, latLng.lat]);
  return [x, y];
}

function boundsToBbox(bounds) {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  const [xmin, ymin] = latLngToLv95(southWest);
  const [xmax, ymax] = latLngToLv95(northEast);

  return [xmin, ymin, xmax, ymax];
}

function bboxToLeafletBounds(bbox) {
  return L.latLngBounds(
    lv95ToLatLng(bbox[0], bbox[1]),
    lv95ToLatLng(bbox[2], bbox[3]),
  );
}

function createHandleIcon(className) {
  return L.divIcon({
    className: '',
    html: `<div class="${className}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

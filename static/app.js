/* gis_plot frontend */

const layersSelect = document.getElementById('layers');
const generateBtn  = document.getElementById('generate-btn');
const statusEl     = document.getElementById('status');

// ---------------------------------------------------------------------------
// Load layers from /api/layers
// ---------------------------------------------------------------------------

async function loadLayers() {
  setStatus('', 'Lade verfügbare WMS-Layer …');
  try {
    const res  = await fetch('/api/layers');
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    layersSelect.innerHTML = '';
    data.forEach(layer => {
      const opt = document.createElement('option');
      opt.value       = layer.id;
      opt.textContent = layer.title || layer.id;
      opt.title       = layer.abstract || '';
      layersSelect.appendChild(opt);
    });

    setStatus('ok', `${data.length} Layer geladen.`);
  } catch (err) {
    setStatus('error', `Fehler beim Laden der Layer: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Generate PDF
// ---------------------------------------------------------------------------

generateBtn.addEventListener('click', async () => {
  const selectedLayers = Array.from(layersSelect.selectedOptions).map(o => o.value);
  if (selectedLayers.length === 0) {
    setStatus('error', 'Bitte mindestens einen Layer auswählen.');
    return;
  }

  const bbox = [
    parseFloat(document.getElementById('xmin').value),
    parseFloat(document.getElementById('ymin').value),
    parseFloat(document.getElementById('xmax').value),
    parseFloat(document.getElementById('ymax').value),
  ];

  if (bbox.some(isNaN)) {
    setStatus('error', 'Ungültige Koordinaten im Kartenausschnitt.');
    return;
  }

  const title = document.getElementById('title').value.trim() || 'Zivilschutz Karte';

  generateBtn.disabled = true;
  setStatus('', '<span class="spinner"></span>PDF wird generiert – dies kann 30–60 Sekunden dauern …');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layers: selectedLayers, bbox, crs: 'EPSG:2056', title }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }

    // Trigger file download
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement('a');
    const cd       = res.headers.get('Content-Disposition') || '';
    const nameMatch = cd.match(/filename="([^"]+)"/);
    anchor.href     = url;
    anchor.download = nameMatch ? nameMatch[1] : 'karte.pdf';
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus('ok', 'PDF erfolgreich generiert und heruntergeladen.');
  } catch (err) {
    setStatus('error', `Fehler: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(cls, html) {
  statusEl.className = cls;
  statusEl.innerHTML = html;
}

// Kick off layer loading immediately
loadLayers();

const { XMLParser } = require('fast-xml-parser');

const { wms } = require('../config');
const { HttpError } = require('../errors/http-error');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: true,
  trimValues: true,
});

let layersCache = {
  expiresAt: 0,
  layers: null,
};

function toArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function flattenLayers(layerNode, acc = []) {
  if (!layerNode || typeof layerNode !== 'object') {
    return acc;
  }

  if (typeof layerNode.Name === 'string' && layerNode.Name.trim()) {
    acc.push({
      id: layerNode.Name.trim(),
      title: typeof layerNode.Title === 'string' && layerNode.Title.trim()
        ? layerNode.Title.trim()
        : layerNode.Name.trim(),
      abstract: typeof layerNode.Abstract === 'string' ? layerNode.Abstract.trim() : '',
    });
  }

  for (const child of toArray(layerNode.Layer)) {
    flattenLayers(child, acc);
  }

  return acc;
}

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(wms.requestTimeoutMs),
  });

  if (!response.ok) {
    throw new HttpError(502, `WMS request failed with status ${response.status}`);
  }

  return response.text();
}

async function listLayers() {
  if (layersCache.layers && layersCache.expiresAt > Date.now()) {
    return layersCache.layers;
  }

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetCapabilities',
    VERSION: wms.version,
  });

  let xml;
  try {
    xml = await fetchText(`${wms.url}?${params.toString()}`);
  } catch (error) {
    throw new HttpError(502, 'Failed to fetch WMS capabilities', { cause: error });
  }

  let parsed;
  try {
    parsed = xmlParser.parse(xml);
  } catch (error) {
    throw new HttpError(502, 'Failed to parse WMS capabilities', { cause: error });
  }

  const root = parsed.WMS_Capabilities || parsed.WMT_MS_Capabilities;
  const layersRoot = root?.Capability?.Layer;

  if (!layersRoot) {
    throw new HttpError(502, 'WMS capabilities did not contain any layers');
  }

  const seen = new Set();
  const layers = flattenLayers(layersRoot)
    .filter(layer => {
      if (seen.has(layer.id)) {
        return false;
      }

      seen.add(layer.id);
      return true;
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'de', { sensitivity: 'base' }));

  layersCache = {
    layers,
    expiresAt: Date.now() + wms.capabilitiesTtlMs,
  };

  return layers;
}

async function fetchMapTile({ layers, bbox, crs, width, height }) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: wms.version,
    CRS: crs,
    BBOX: bbox.join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
    LAYERS: layers.join(','),
    STYLES: '',
    FORMAT: wms.defaultFormat,
    TRANSPARENT: 'FALSE',
  });

  let response;
  try {
    response = await fetch(`${wms.url}?${params.toString()}`, {
      signal: AbortSignal.timeout(wms.requestTimeoutMs),
    });
  } catch (error) {
    throw new HttpError(502, 'Failed to fetch WMS map tile', { cause: error });
  }

  if (!response.ok) {
    throw new HttpError(502, `WMS GetMap failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const message = (await response.text()).trim();
    throw new HttpError(502, message || 'WMS GetMap did not return an image');
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  fetchMapTile,
  listLayers,
};

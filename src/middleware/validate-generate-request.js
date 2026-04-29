const { wms } = require('../config');
const { HttpError } = require('../errors/http-error');

function validateGenerateRequest(req, _res, next) {
  const {
    layers,
    bbox,
    printArea,
    crs = wms.defaultCrs,
    title = '',
  } = req.body || {};

  if (!Array.isArray(layers) || layers.length === 0 || !layers.every(layer => typeof layer === 'string' && layer.trim())) {
    next(new HttpError(400, 'At least one layer must be specified'));
    return;
  }

  if (typeof crs !== 'string' || !crs.trim()) {
    next(new HttpError(400, 'crs must be a non-empty string'));
    return;
  }

  if (typeof title !== 'string') {
    next(new HttpError(400, 'title must be a string'));
    return;
  }

  let numericBbox = null;
  if (bbox !== undefined) {
    if (!Array.isArray(bbox) || bbox.length !== 4) {
      next(new HttpError(400, 'bbox must be [xmin, ymin, xmax, ymax]'));
      return;
    }

    numericBbox = bbox.map(value => Number(value));
    if (numericBbox.some(value => Number.isNaN(value) || !Number.isFinite(value))) {
      next(new HttpError(400, 'bbox must only contain numbers'));
      return;
    }

    const [xmin, ymin, xmax, ymax] = numericBbox;
    if (xmin >= xmax || ymin >= ymax) {
      next(new HttpError(400, 'bbox must define a valid extent'));
      return;
    }
  }

  let normalizedPrintArea = null;
  if (printArea !== undefined) {
    if (typeof printArea !== 'object' || printArea === null) {
      next(new HttpError(400, 'printArea must be an object'));
      return;
    }

    const centerX = Number(printArea.centerX);
    const centerY = Number(printArea.centerY);
    const width = Number(printArea.width);
    const height = Number(printArea.height);
    const rotationDeg = Number(printArea.rotationDeg || 0);

    if ([centerX, centerY, width, height, rotationDeg].some(value => Number.isNaN(value) || !Number.isFinite(value))) {
      next(new HttpError(400, 'printArea values must be numeric'));
      return;
    }

    if (width <= 0 || height <= 0) {
      next(new HttpError(400, 'printArea width and height must be positive'));
      return;
    }

    normalizedPrintArea = {
      centerX,
      centerY,
      width,
      height,
      rotationDeg,
    };
  }

  if (!numericBbox && !normalizedPrintArea) {
    next(new HttpError(400, 'Either bbox or printArea must be provided'));
    return;
  }

  req.generateRequest = {
    layers: layers.map(layer => layer.trim()),
    bbox: numericBbox,
    printArea: normalizedPrintArea,
    crs: crs.trim(),
    title: title.trim(),
  };

  next();
}

module.exports = { validateGenerateRequest };

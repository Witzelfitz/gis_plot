const { PNG } = require('pngjs');

const { render, wms } = require('../config');
const { fetchMapTile } = require('./wms-service');

function getA0PixelSize() {
  return {
    width: Math.round((render.a0WidthMm / 25.4) * render.dpi),
    height: Math.round((render.a0HeightMm / 25.4) * render.dpi),
  };
}

function createCanvas(width, height) {
  const png = new PNG({ width, height });

  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 255;
    png.data[index + 1] = 255;
    png.data[index + 2] = 255;
    png.data[index + 3] = 255;
  }

  return png;
}

function blitTile(target, tile, left, top) {
  for (let row = 0; row < tile.height; row += 1) {
    const sourceStart = row * tile.width * 4;
    const sourceEnd = sourceStart + (tile.width * 4);
    const targetStart = ((top + row) * target.width + left) * 4;
    tile.data.copy(target.data, targetStart, sourceStart, sourceEnd);
  }
}

async function getMapImage({ layers, bbox, crs, width, height }) {
  if (width <= wms.maxTilePx && height <= wms.maxTilePx) {
    return fetchMapTile({ layers, bbox, crs, width, height });
  }

  const cols = Math.ceil(width / wms.maxTilePx);
  const rows = Math.ceil(height / wms.maxTilePx);
  const [xmin, ymin, xmax, ymax] = bbox;
  const xSpan = xmax - xmin;
  const ySpan = ymax - ymin;
  const tileJobs = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = col * wms.maxTilePx;
      const top = row * wms.maxTilePx;
      const tileWidth = Math.min(wms.maxTilePx, width - left);
      const tileHeight = Math.min(wms.maxTilePx, height - top);

      const tileXMin = xmin + (left / width) * xSpan;
      const tileXMax = xmin + ((left + tileWidth) / width) * xSpan;
      const tileYMax = ymax - (top / height) * ySpan;
      const tileYMin = ymax - ((top + tileHeight) / height) * ySpan;

      tileJobs.push(
        fetchMapTile({
          layers,
          bbox: [tileXMin, tileYMin, tileXMax, tileYMax],
          crs,
          width: tileWidth,
          height: tileHeight,
        }).then(tileBuffer => ({
          input: tileBuffer,
          left,
          top,
        })),
      );
    }
  }

  const composites = await Promise.all(tileJobs);
  const canvas = createCanvas(width, height);

  composites.forEach(tile => {
    blitTile(canvas, PNG.sync.read(tile.input), tile.left, tile.top);
  });

  return PNG.sync.write(canvas);
}

module.exports = {
  getA0PixelSize,
  getMapImage,
};

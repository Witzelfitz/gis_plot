const { getA0PixelSize, getMapImage } = require('./map-service');
const { renderA0Pdf } = require('./pdf-service');

async function generatePdf({ layers, bbox, printArea, crs, title }) {
  const { width, height } = getA0PixelSize();
  const effectiveBbox = printArea
    ? [
        printArea.centerX - (printArea.width / 2),
        printArea.centerY - (printArea.height / 2),
        printArea.centerX + (printArea.width / 2),
        printArea.centerY + (printArea.height / 2),
      ]
    : bbox;

  const mapImage = await getMapImage({
    layers,
    bbox: effectiveBbox,
    crs,
    width,
    height,
  });

  return renderA0Pdf({
    mapImage,
    title,
    bbox: effectiveBbox,
    crs,
  });
}

module.exports = { generatePdf };

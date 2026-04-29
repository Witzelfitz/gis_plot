const PDFDocument = require('pdfkit');

const { render } = require('../config');
const { roundScaleLength } = require('../utils/math');

function mmToPt(mm) {
  return (mm / 25.4) * 72;
}

function createDocumentBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      info: {
        Title: 'gis_plot',
        Producer: 'gis_plot Node.js server',
      },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawNorthArrow(doc, mapRect) {
  const x = mapRect.x + mapRect.width - 26;
  const topY = mapRect.y + 18;
  const bottomY = topY + 42;

  doc
    .save()
    .lineWidth(1.5)
    .moveTo(x, bottomY)
    .lineTo(x, topY)
    .strokeColor('black')
    .stroke();

  doc
    .moveTo(x, topY - 10)
    .lineTo(x - 7, topY + 6)
    .lineTo(x + 7, topY + 6)
    .fill('black');

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('black')
    .text('N', x - 5, bottomY + 4, {
      width: 10,
      align: 'center',
    })
    .restore();
}

function drawScaleBar(doc, mapRect, bbox) {
  const xSpanMeters = bbox[2] - bbox[0];
  const targetMeters = xSpanMeters * 0.2;
  const barMeters = roundScaleLength(targetMeters);
  const barWidth = mapRect.width * (barMeters / xSpanMeters);
  const segmentWidth = barWidth / 4;
  const barX = mapRect.x + 22;
  const barY = mapRect.y + mapRect.height - 44;
  const barHeight = 8;
  const panelX = barX - 14;
  const panelY = barY - 18;
  const panelWidth = Math.max(barWidth + 44, 185);
  const panelHeight = 56;

  doc
    .save()
    .roundedRect(panelX, panelY, panelWidth, panelHeight, 6)
    .fillAndStroke('#ffffff', '#cbd2d9')
    .restore();

  for (let index = 0; index < 4; index += 1) {
    doc
      .save()
      .rect(barX + index * segmentWidth, barY, segmentWidth, barHeight)
      .fillAndStroke(index % 2 === 0 ? 'black' : 'white', 'black')
      .restore();
  }

  let labelValue = barMeters;
  let unit = 'm';
  if (labelValue >= 1000) {
    labelValue /= 1000;
    unit = 'km';
  }

  const labelY = barY + barHeight + 4;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('black')
    .text('0', barX - 4, labelY, { width: 12, align: 'center' })
    .text(`${labelValue / 2} ${unit}`, barX + barWidth / 2 - 20, labelY, { width: 40, align: 'center' })
    .text(`${labelValue} ${unit}`, barX + barWidth - 20, labelY, { width: 40, align: 'center' });

  const printedWidthMeters = (mapRect.width / 72) * 0.0254;
  const scaleDenominator = xSpanMeters / printedWidthMeters;
  const roundedScale = roundScaleDenominator(scaleDenominator);
  const printDate = new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  }).format(new Date());

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#102a43')
    .text(`Maßstab ca. 1:${formatScale(roundedScale)}`, barX, labelY + 14, {
      width: panelWidth - 20,
      align: 'left',
    });

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#486581')
    .text(`Druckdatum: ${printDate}`, barX, labelY + 27, {
      width: panelWidth - 20,
      align: 'left',
    });
}

async function renderA0Pdf({ mapImage, title, bbox, crs }) {
  const pageWidth = mmToPt(render.a0WidthMm);
  const pageHeight = mmToPt(render.a0HeightMm);
  const marginX = mmToPt(render.marginMm);
  const marginY = mmToPt(render.marginMm);
  const hasTitle = Boolean(title && title.trim());
  const titleBandHeight = hasTitle ? pageHeight * 0.04 : 0;
  const titleGap = hasTitle ? 18 : 0;
  const mapRect = {
    x: marginX,
    y: marginY + titleBandHeight + titleGap,
    width: pageWidth - (2 * marginX),
    height: pageHeight - (2 * marginY) - titleBandHeight - titleGap,
  };

  return createDocumentBuffer(doc => {
    doc.addPage({
      size: [pageWidth, pageHeight],
      margin: 0,
    });

    if (hasTitle) {
      doc
        .font('Helvetica-Bold')
        .fontSize(28)
        .fillColor('black')
        .text(title, marginX, marginY + 10, {
          width: pageWidth - (2 * marginX),
          align: 'center',
        });
    }

    doc.image(mapImage, mapRect.x, mapRect.y, {
      width: mapRect.width,
      height: mapRect.height,
    });

    doc
      .save()
      .lineWidth(1)
      .strokeColor('black')
      .rect(mapRect.x, mapRect.y, mapRect.width, mapRect.height)
      .stroke()
      .restore();

    drawNorthArrow(doc, mapRect);
    drawScaleBar(doc, mapRect, bbox);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#555555')
      .text(`Quelle: swisstopo - map.geo.admin.ch | ${crs}`, marginX, pageHeight - marginY + 4, {
        width: pageWidth - (2 * marginX),
        align: 'right',
      });
  });
}

module.exports = {
  renderA0Pdf,
};

function roundScaleDenominator(value) {
  if (value < 1000) {
    return Math.round(value / 50) * 50;
  }
  if (value < 10000) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value / 1000) * 1000;
}

function formatScale(value) {
  return new Intl.NumberFormat('de-CH').format(value);
}

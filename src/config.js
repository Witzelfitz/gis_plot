const path = require('path');

const host = process.env.HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || '1726', 10);

function parseTrustProxy(value) {
  if (value === undefined) {
    return true;
  }

  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return value;
}

module.exports = {
  host,
  port,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  rootDir: path.resolve(__dirname, '..'),
  templateDir: path.resolve(__dirname, '..', 'templates'),
  staticDir: path.resolve(__dirname, '..', 'static'),
  wms: {
    url: 'https://wms.geo.admin.ch/',
    version: '1.3.0',
    defaultCrs: 'EPSG:2056',
    defaultFormat: 'image/png',
    maxTilePx: 2048,
    capabilitiesTtlMs: 15 * 60 * 1000,
    requestTimeoutMs: 20_000,
  },
  render: {
    a0WidthMm: 1189,
    a0HeightMm: 841,
    marginMm: 20,
    dpi: 150,
  },
  rateLimit: {
    generateWindowMs: 20_000,
  },
};

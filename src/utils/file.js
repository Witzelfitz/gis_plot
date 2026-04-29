function sanitizeFilename(title) {
  const sanitized = String(title || 'Zivilschutz Karte')
    .replace(/[^a-zA-Z0-9 _-]/g, '_')
    .trim()
    .replace(/\s+/g, '_');

  return `${sanitized || 'Zivilschutz_Karte'}.pdf`;
}

module.exports = { sanitizeFilename };

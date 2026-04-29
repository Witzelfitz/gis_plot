const express = require('express');

const { HttpError } = require('../errors/http-error');
const { validateGenerateRequest } = require('../middleware/validate-generate-request');
const { generatePdf } = require('../services/generate-service');
const { listLayers } = require('../services/wms-service');
const { sanitizeFilename } = require('../utils/file');

const router = express.Router();

router.get('/layers', async (_req, res, next) => {
  try {
    const layers = await listLayers();
    res.json(layers);
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(502, 'Failed to fetch WMS layers', { cause: error }));
  }
});

router.post('/generate', validateGenerateRequest, async (req, res, next) => {
  try {
    const pdfBuffer = await generatePdf(req.generateRequest);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(req.generateRequest.title)}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(500, 'PDF generation failed', { cause: error }));
  }
});

module.exports = { apiRouter: router };

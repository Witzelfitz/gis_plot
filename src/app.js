const express = require('express');
const path = require('path');

const { staticDir, templateDir, trustProxy } = require('./config');
const { HttpError } = require('./errors/http-error');
const { apiRouter } = require('./routes/api');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', trustProxy);
app.use(express.json({ limit: '1mb' }));
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules')));
app.use('/static', express.static(staticDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(templateDir, 'index.html'));
});

app.use('/api', apiRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }

  const statusCode = error.statusCode || 500;
  const message = error.expose === false ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({ error: message });
});

module.exports = app;

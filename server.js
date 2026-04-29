const app = require('./src/app');
const { host, port } = require('./src/config');

app.listen(port, host, () => {
  console.log(`gis_plot server listening on http://${host}:${port}`);
});

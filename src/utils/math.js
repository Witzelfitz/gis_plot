function roundScaleLength(targetMeters) {
  const magnitude = 10 ** Math.floor(Math.log10(targetMeters));
  return Math.round(targetMeters / magnitude) * magnitude;
}

module.exports = { roundScaleLength };

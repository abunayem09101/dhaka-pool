// Central error handler: every route calls next(err) on failure and
// this decides the HTTP status + JSON shape. Keeps route code clean of
// repetitive try/catch status juggling.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(statusCode).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;

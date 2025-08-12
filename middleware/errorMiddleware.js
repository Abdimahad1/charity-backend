exports.notFound = (_req, _res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  };
  
  exports.errorHandler = (err, _req, res, _next) => {
    const status = err.status || 500;
    const message = err.message || 'Server error';
    if (process.env.NODE_ENV !== 'test') {
      console.error('❌', status, message);
    }
    res.status(status).json({ message });
  };
  
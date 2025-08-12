const jwt = require('jsonwebtoken');

exports.protect = (req, _res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return next({ status: 401, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch {
    next({ status: 401, message: 'Invalid token' });
  }
};

exports.requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'Admin') return next({ status: 403, message: 'Admin only' });
  next();
};

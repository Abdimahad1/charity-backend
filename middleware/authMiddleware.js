const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select('isActive');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User no longer exists or is deactivated.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Authentication failed.' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

exports.requireAdminOrModerator = (req, res, next) => {
  if (req.user?.role !== 'Admin' && req.user?.role !== 'Moderator') {
    return res.status(403).json({ message: 'Admin or Moderator access required.' });
  }
  next();
};
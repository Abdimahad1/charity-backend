const Activity = require('../models/Activity');
const User = require('../models/User');

/** GET /api/activity/admin - Get admin activity feed */
exports.getAdminActivity = async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const activities = await Activity.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    res.json(activities);
  } catch (err) {
    console.error('Error fetching activity:', err);
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
};

/** Create activity log (utility function) */
exports.logActivity = async (userId, action, entityType = null, entityId = null, details = {}) => {
  try {
    await Activity.create({
      user: userId,
      action,
      entityType,
      entityId,
      details
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
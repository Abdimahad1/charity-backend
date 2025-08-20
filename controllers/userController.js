const User = require('../models/User');

// Get all users with pagination and filtering
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (status) {
      filter.isActive = status === 'active';
    }
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email');
    
    const total = await User.countDocuments(filter);
    
    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'name email');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, isActive } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }
    
    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'Viewer',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'User created successfully.',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    res.status(500).json({ message: 'Failed to create user.' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive, password } = req.body;
    const userId = req.params.id;
    
    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already taken by another user.' });
      }
    }
    
    const updateData = { 
      name, 
      email: email ? email.toLowerCase() : undefined, 
      role, 
      isActive 
    };
    
    // Only update password if provided
    if (password && password.trim() !== '') {
      updateData.password = password;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    res.json({
      message: 'User updated successfully.',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
    res.status(500).json({ message: 'Failed to update user.' });
  }
};

// Delete user with super admin protection
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account.' });
    }
    
    // Get the user to be deleted
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Get the current user (the one trying to delete)
    const currentUser = await User.findById(req.user.id);
    
    // Prevent deletion of super admin (oldest admin)
    const oldestAdmin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 });
    
    if (userToDelete._id.toString() === oldestAdmin._id.toString()) {
      return res.status(400).json({ 
        message: 'Cannot delete the super admin account. This is the oldest admin account in the system.' 
      });
    }
    
    // Prevent admins from deleting older admins
    if (userToDelete.role === 'Admin' && currentUser.role === 'Admin') {
      if (userToDelete.createdAt < currentUser.createdAt) {
        return res.status(400).json({ 
          message: 'You cannot delete an admin who is older than you.' 
        });
      }
    }
    
    // Actually delete the user
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'Admin' });
    const moderatorUsers = await User.countDocuments({ role: 'Moderator' });
    const viewerUsers = await User.countDocuments({ role: 'Viewer' });
    
    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      moderatorUsers,
      viewerUsers,
      recentUsers
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to fetch user statistics.' });
  }
};
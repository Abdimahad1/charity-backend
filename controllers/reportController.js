// controllers/reportController.js
const Report = require('../models/Report');
const Payment = require('../models/Payment');
const Volunteer = require('../models/Volunteer');
const Charity = require('../models/Charity');

// Generate report data
exports.generateReport = async (req, res, next) => {
  try {
    const { type, period = 'month', filters = {} } = req.body;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }
    
    let reportData;
    
    switch (type) {
      case 'donations':
        reportData = await generateDonationsReport(startDate, filters);
        break;
      case 'volunteers':
        reportData = await generateVolunteersReport(startDate, filters);
        break;
      case 'charities':
        reportData = await generateCharitiesReport(filters);
        break;
      case 'finance':
        reportData = await generateFinanceReport(startDate, filters);
        break;
      case 'collections':
        reportData = await generateCollectionsReport(filters);
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
    
    // Save report to database
    const report = await Report.create({
      type,
      period,
      startDate,
      endDate: new Date(),
      filters,
      generatedBy: req.user?._id,
      data: reportData
    });
    
    res.json(report);
  } catch (err) {
    next(err);
  }
};

// Get saved reports
exports.getReports = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (type) query.type = type;
    
    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('generatedBy', 'name email');
    
    const total = await Report.countDocuments(query);
    
    res.json({
      reports,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    next(err);
  }
};

// Helper functions for each report type
async function generateDonationsReport(startDate, filters) {
  const query = { 
    status: 'success',
    createdAt: { $gte: startDate }
  };
  
  if (filters.method && filters.method !== 'all') {
    query.method = filters.method;
  }
  
  if (filters.currency && filters.currency !== 'all') {
    query.currency = filters.currency;
  }
  
  const donations = await Payment.find(query)
    .sort({ createdAt: -1 })
    .select('amount currency method name email phone createdAt');
  
  const summary = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
  
  const byMethod = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$method',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byCurrency = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$currency',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    donations,
    summary: summary[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
    byMethod,
    byCurrency
  };
}

async function generateVolunteersReport(startDate, filters) {
  const query = { createdAt: { $gte: startDate } };
  
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }
  
  if (filters.city) {
    query.city = { $regex: filters.city, $options: 'i' };
  }
  
  const volunteers = await Volunteer.find(query)
    .sort({ createdAt: -1 })
    .select('fullName email phone city district status role skills interests createdAt');
  
  const summary = await Volunteer.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byStatus = await Volunteer.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byCity = await Volunteer.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$city',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    volunteers,
    summary: summary[0] || { count: 0 },
    byStatus,
    byCity
  };
}

async function generateCharitiesReport(filters) {
  const query = {};
  
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }
  
  if (filters.category) {
    query.category = filters.category;
  }
  
  const charities = await Charity.find(query)
    .sort({ createdAt: -1 })
    .select('title excerpt category location goal raised status cover donationLink featured createdAt');
  
  const summary = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalGoal: { $sum: '$goal' },
        totalRaised: { $sum: '$raised' }
      }
    }
  ]);
  
  const byStatus = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const byCategory = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    charities,
    summary: summary[0] || { count: 0, totalGoal: 0, totalRaised: 0 },
    byStatus,
    byCategory
  };
}

async function generateFinanceReport(startDate, filters) {
  const query = { 
    status: 'success',
    createdAt: { $gte: startDate }
  };
  
  if (filters.currency && filters.currency !== 'all') {
    query.currency = filters.currency;
  }
  
  const monthlyData = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        donations: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  // Format monthly data for display
  const formattedMonthlyData = monthlyData.map(item => ({
    month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    donationsUSD: item.donations,
    count: item.count
  }));
  
  const summary = await Payment.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
  
  return {
    monthlyData: formattedMonthlyData,
    summary: summary[0] || { totalAmount: 0, count: 0, avgAmount: 0 }
  };
}

async function generateCollectionsReport(filters) {
  // For collections, we'll use charities as they represent fundraising campaigns
  const query = {};
  
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }
  
  if (filters.category) {
    query.category = filters.category;
  }
  
  const charities = await Charity.find(query)
    .sort({ createdAt: -1 })
    .select('title category goal raised status createdAt');
  
  const summary = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalGoal: { $sum: '$goal' },
        totalRaised: { $sum: '$raised' },
        completionRate: { $avg: { $divide: ['$raised', '$goal'] } }
      }
    }
  ]);
  
  const byStatus = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalGoal: { $sum: '$goal' },
        totalRaised: { $sum: '$raised' }
      }
    }
  ]);
  
  const byCategory = await Charity.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalGoal: { $sum: '$goal' },
        totalRaised: { $sum: '$raised' }
      }
    }
  ]);
  
  return {
    collections: charities,
    summary: summary[0] || { count: 0, totalGoal: 0, totalRaised: 0, completionRate: 0 },
    byStatus,
    byCategory
  };
}
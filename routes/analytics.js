const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Certificate = require('../models/Certificate');

// Database wrapper function
const withDB = (handler) => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    }
  };
};

// Track usage analytics
router.post('/', withDB(async (req, res) => {
  try {
    console.log('📊 Usage analytics received:', req.body);
    
    const { type, action, timestamp, userAgent, url } = req.body;
    
    // Validate required fields
    if (!type || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Type and action are required' 
      });
    }
    
    // Store analytics data (you can add a database model for this later)
    // For now, just log it
    console.log('📊 Analytics stored:', {
      type,
      action,
      timestamp: timestamp || new Date().toISOString(),
      userAgent,
      url
    });
    
    res.json({ 
      success: true, 
      message: 'Analytics data received successfully' 
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing analytics data' 
    });
  }
}));

// Get dashboard analytics
router.get('/dashboard', withDB(async (req, res) => {
  try {
    console.log('🔍 Analytics dashboard requested');
    
    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalCertificates = await Certificate.countDocuments();
    
    console.log('📊 Basic counts:', { totalUsers, totalCertificates });
    
    // Get certificate status counts
    const activeCertificates = await Certificate.countDocuments({ status: 'active' });
    const revokedCertificates = await Certificate.countDocuments({ status: 'revoked' });
    
    console.log('📊 Certificate counts:', { activeCertificates, revokedCertificates });
    
    // Get users by state
    const usersByState = await User.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get users by position
    const usersByPosition = await User.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = await User.countDocuments({
      dateAdded: { $gte: sevenDaysAgo }
    });
    
    const recentCertificates = await Certificate.countDocuments({
      dateIssued: { $gte: sevenDaysAgo }
    });
    
    // Get system health data
    const systemHealth = {
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    };
    
    const responseData = {
      success: true,
      data: {
        totalUsers,
        totalMembers: totalUsers, // Alias for frontend compatibility
        totalCertificates,
        activeCertificates,
        revokedCertificates,
        usersByState,
        usersByPosition,
        recentUsers,
        recentCertificates,
        systemHealth
      }
    };
    
    console.log('📊 Sending analytics response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics data' 
    });
  }
}));

module.exports = router; 
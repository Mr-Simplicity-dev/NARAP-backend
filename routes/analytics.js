const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Certificate = require('../models/Certificate');

// Database wrapper function
const withDB = (handler) => {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({
                success: false,
                message: 'Database operation failed',
                error: error.message
            });
        }
    };
};

// OPTIONS handler for CORS preflight requests
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.status(204).end();
});

// POST endpoint for analytics data
router.post('/', withDB(async (req, res) => {
    // Set CORS headers explicitly
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
    try {
        const { type, action, timestamp, userAgent, url } = req.body;
        
        console.log('📊 Analytics data received:', { type, action, timestamp, userAgent, url });
        
        // For now, just log the analytics data
        // You can add a database model for this later
        console.log('📊 Analytics stored:', {
            type,
            action,
            timestamp: timestamp || new Date().toISOString(),
            userAgent,
            url,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Analytics data recorded successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record analytics data',
            error: error.message
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

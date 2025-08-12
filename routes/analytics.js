const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Certificate = require('../models/Certificate');

// List of all Nigerian states + FCT
const allStatesList = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara"
];

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
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
    try {
        const { type, action, timestamp, userAgent, url } = req.body;
        
        console.log('📊 Analytics data received:', { type, action, timestamp, userAgent, url });
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

// Get dashboard analytics (FIXED)
router.get('/dashboard', withDB(async (req, res) => {
  try {
    const startTime = Date.now(); // Manual query timer
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Execute all queries in parallel
    const [
      totalCounts,
      certificateStatus,
      stateAggregation,
      positionAggregation,
      recentActivity
    ] = await Promise.all([
      // Basic counts
      Promise.all([
        User.countDocuments(),
        Certificate.countDocuments()
      ]),
      
      // Certificate status
      Promise.all([
        Certificate.countDocuments({ status: 'active' }),
        Certificate.countDocuments({ status: 'revoked' })
      ]),
      
      // States aggregation
      User.aggregate([
        { $match: { state: { $exists: true, $ne: '' } } },
        { $group: { _id: { $trim: { input: "$state" } }, value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ]).allowDiskUse(true),
      
      // Positions aggregation
      User.aggregate([
        { $match: { position: { $exists: true, $ne: '' } } },
        { $group: { _id: { $trim: { input: "$position" } }, value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ]),
      
      // Recent activity
      Promise.all([
        User.countDocuments({ dateAdded: { $gte: sevenDaysAgo } }),
        Certificate.countDocuments({ dateIssued: { $gte: sevenDaysAgo } })
      ])
    ]);

    // Merge stateAggregation with all states list to ensure all states appear
    const stateMap = new Map(stateAggregation.map(s => [s.name.toLowerCase(), s.value]));
    const usersByState = allStatesList.map(stateName => ({
      name: stateName,
      value: stateMap.get(stateName.toLowerCase()) || 0
    }));

    const queryTime = Date.now() - startTime; // Capture timing

    const responseData = {
      success: true,
      data: {
        totalUsers: totalCounts[0],
        totalMembers: totalCounts[0],
        totalCertificates: totalCounts[1],
        activeCertificates: certificateStatus[0],
        revokedCertificates: certificateStatus[1],
        usersByState,
        usersByPosition: positionAggregation,
        recentUsers: recentActivity[0],
        recentCertificates: recentActivity[1],
        systemHealth: {
          database: 'connected',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date()
        },
        performance: {
          queryTime: `${queryTime}ms`
        }
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

module.exports = router;

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

// Get dashboard analytics (OPTIMIZED VERSION)
router.get('/dashboard', withDB(async (req, res) => {
  try {
    console.time('AnalyticsQueryTime'); // Start performance timer
    
    // Get the date range first since it's used in multiple queries
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run all parallel queries at once
    const [
      totalUsers,
      totalCertificates,
      activeCertificates,
      revokedCertificates,
      usersByPosition,
      recentUsers,
      recentCertificates,
      usersByState
    ] = await Promise.all([
      User.countDocuments(),
      Certificate.countDocuments(),
      Certificate.countDocuments({ status: 'active' }),
      Certificate.countDocuments({ status: 'revoked' }),
      User.aggregate([
        { $group: { _id: '$position', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.countDocuments({ dateAdded: { $gte: sevenDaysAgo } }),
      Certificate.countDocuments({ dateIssued: { $gte: sevenDaysAgo } }),
      // OPTIMIZED State aggregation
      User.aggregate([
        { 
          $project: {
            state: { $ifNull: ["$state", "Unknown"] } 
          } 
        },
        { 
          $group: { 
            _id: "$state", 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { count: -1 } },
        { 
          $project: {
            state: "$_id",
            count: 1,
            _id: 0
          }
        }
      ]).allowDiskUse(true) // Enable for large datasets
    ]);

    console.timeEnd('AnalyticsQueryTime'); // Log query time
    
    // Transform usersByPosition for consistent response format
    const formattedPositions = usersByPosition.map(item => ({
      position: item._id,
      count: item.count
    }));

    const response = {
      success: true,
      data: {
        totals: {
          users: totalUsers,
          certificates: totalCertificates
        },
        certificates: {
          active: activeCertificates,
          revoked: revokedCertificates
        },
        distribution: {
          byState: usersByState,
          byPosition: formattedPositions
        },
        recentActivity: {
          users: recentUsers,
          certificates: recentCertificates,
          since: sevenDaysAgo.toISOString()
        },
        meta: {
          generatedAt: new Date().toISOString(),
          responseTime: `${console.timeEnd('AnalyticsQueryTime')}ms`
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

module.exports = router;

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

// Get dashboard analytics (FIXED VERSION)
router.get('/dashboard', withDB(async (req, res) => {
  try {
    console.log('🔍 Analytics dashboard requested');
    
    // Debug: Check sample users to verify state field structure
    const sampleUsers = await User.find().select('state').limit(5);
    console.log('Sample user states:', sampleUsers.map(u => u.state));
    
    // Get all counts in parallel for better performance
    const [
      totalUsers,
      totalCertificates,
      activeCertificates,
      revokedCertificates
    ] = await Promise.all([
      User.countDocuments(),
      Certificate.countDocuments(),
      Certificate.countDocuments({ status: 'active' }),
      Certificate.countDocuments({ status: 'revoked' })
    ]);
    
    // FIXED: Users by state aggregation with null handling
    const usersByState = await User.aggregate([
      { 
        $project: {
          // Handle both root-level and nested state fields
          state: {
            $ifNull: [
              "$state",
              "$address.state", // Check nested field if exists
              "Unknown"
            ]
          }
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
    ]);
    
    console.log('Users by state results:', usersByState);
    
    // Users by position
    const usersByPosition = await User.aggregate([
      { 
        $group: { 
          _id: { $ifNull: ["$position", "Unspecified"] },
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [recentUsers, recentCertificates] = await Promise.all([
      User.countDocuments({ dateAdded: { $gte: sevenDaysAgo } }),
      Certificate.countDocuments({ dateIssued: { $gte: sevenDaysAgo } })
    ]);
    
    // Final response
    const responseData = {
      success: true,
      data: {
        totalUsers,
        totalMembers: totalUsers, // Alias
        totalCertificates,
        certificateStatus: {
          active: activeCertificates,
          revoked: revokedCertificates
        },
        usersByState,
        usersByPosition,
        recentActivity: {
          users: recentUsers,
          certificates: recentCertificates
        },
        lastUpdated: new Date().toISOString()
      }
    };
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics data',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

module.exports = router;

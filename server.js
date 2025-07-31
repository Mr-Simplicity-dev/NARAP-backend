const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = [
  'https://narapdb.com.ng',
  'http://narapdb.com.ng',
  'https://www.narapdb.com.ng',
  'http://www.narapdb.com.ng',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://localhost:3000',
  'https://localhost:5173',
  'http://localhost:5000',
  'https://localhost:5000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development or if explicitly configured
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_ALL_ORIGINS === 'true') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      // In production, be more permissive but log the origin
      if (process.env.NODE_ENV === 'production') {
        console.log('Allowing blocked origin in production:', origin);
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'X-File-Name'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly for all routes
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      maxPoolSize: 10,
      bufferCommands: true
    });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const certificateRoutes = require('./routes/certificates');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/uploads');
const healthRoutes = require('./routes/health');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NARAP Backend API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      certificates: '/api/certificates',
      analytics: '/api/analytics',
      uploads: '/api/uploads',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/api/auth',
      '/api/users', 
      '/api/certificates',
      '/api/analytics',
      '/api/uploads',
      '/api/health'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong on the server' 
      : error.message,
    timestamp: new Date().toISOString()
  });
});

// Clear all database data function
async function clearAllDatabaseData() {
  try {
    console.log('🗑️ Clearing all database data...');
    const User = require('./models/User');
    const Certificate = require('./models/Certificate');
    
    // Clear all users
    const userResult = await User.deleteMany({});
    console.log(`✅ Deleted ${userResult.deletedCount} users`);
    
    // Clear all certificates
    const certificateResult = await Certificate.deleteMany({});
    console.log(`✅ Deleted ${certificateResult.deletedCount} certificates`);
    
    const totalDeleted = userResult.deletedCount + certificateResult.deletedCount;
    console.log(`✅ Database cleared successfully. Total records deleted: ${totalDeleted}`);
    
    return {
      usersDeleted: userResult.deletedCount,
      certificatesDeleted: certificateResult.deletedCount,
      totalDeleted: totalDeleted
    };
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

// Database cleanup function
async function cleanupDatabaseCertificates() {
  try {
    console.log('🧹 Cleaning up database certificates with null certificate numbers...');
    const Certificate = require('./models/Certificate');
    
    // Find all certificates with null certificate numbers
    const certificates = await Certificate.find({
      $or: [
        { certificateNumber: null },
        { certificateNumber: { $exists: false } },
        { certificateNumber: "" }
      ]
    });
    
    console.log(`Found ${certificates.length} certificates with null certificate numbers`);
    
    for (const cert of certificates) {
      // Generate a unique certificate number
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newCertificateNumber = `NARAP-CERT-${timestamp}-${randomSuffix}`;
      
      // Update the certificate
      await Certificate.findByIdAndUpdate(cert._id, {
        certificateNumber: newCertificateNumber,
        number: newCertificateNumber
      });
      
      console.log(`✅ Fixed certificate ${cert._id} with new number: ${newCertificateNumber}`);
    }
    
    console.log('✅ Database cleanup completed successfully');
    return certificates.length;
  } catch (error) {
    console.error('❌ Error cleaning up database certificates:', error);
    throw error;
  }
}

// Clear all database data endpoint
app.post('/api/clear-database', async (req, res) => {
  try {
    const result = await clearAllDatabaseData();
    res.json({
      success: true,
      message: `Successfully cleared database. Deleted ${result.totalDeleted} records (${result.usersDeleted} users, ${result.certificatesDeleted} certificates)`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear database',
      error: error.message
    });
  }
});

// Cleanup certificates endpoint
app.post('/api/cleanup-certificates', async (req, res) => {
  try {
    const count = await cleanupDatabaseCertificates();
    res.json({
      success: true,
      message: `Successfully cleaned up ${count} certificates`,
      count: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup certificates',
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 NARAP Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`📝 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Start the server
startServer(); 
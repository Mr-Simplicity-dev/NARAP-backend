const express = require('express');
const router = express.Router();

// Health check route
router.get('/', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'NARAP Backend API Server is running',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    cors: {
      enabled: true,
      origins: ['https://narapdb.com.ng', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });
});

// Detailed health check
router.get('/detailed', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    cors: {
      enabled: true,
      origins: ['https://narapdb.com.ng', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });
});

// CORS test endpoint
router.post('/cors-test', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.json({
    status: 'success',
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    cors: {
      enabled: true,
      origin: req.headers.origin,
      allowed: true
    }
  });
});

// Simple test endpoint
router.get('/test', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.json({
    status: 'success',
    message: 'Backend is accessible',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    cors: {
      enabled: true,
      origin: req.headers.origin,
      allowed: true
    }
  });
});

// Connection test endpoint
router.get('/connection', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.json({
    status: 'connected',
    message: 'Backend connection successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    cors: {
      enabled: true,
      origin: req.headers.origin,
      allowed: true
    }
  });
});

module.exports = router; 
const express = require('express');
const router = express.Router();

// Health check route
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'NARAP Backend API Server is running'
  });
});

// Detailed health check
router.get('/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// CORS test endpoint
router.post('/cors-test', (req, res) => {
  res.json({
    status: 'success',
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers
  });
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend is accessible',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

module.exports = router; 
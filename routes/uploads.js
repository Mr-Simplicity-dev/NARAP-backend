const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cloudStorage = require('../cloud-storage');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const passportsDir = path.join(uploadsDir, 'passports');
const signaturesDir = path.join(uploadsDir, 'signatures');

// Create directories if they don't exist
[uploadsDir, passportsDir, signaturesDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created uploads directory: ${dir}`);
    }
  } catch (error) {
    console.error(`❌ Error creating uploads directory ${dir}:`, error);
  }
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send();
});

// Serve uploaded files
router.get('/passports/:filename', async (req, res) => {
    const filename = req.params.filename;
    console.log('🔍 Serving passport file:', { filename });
    
    try {
        const fileData = await cloudStorage.getFile(filename, 'passportPhoto');
        
        // If it's a Cloudinary file, redirect to the URL
        if (fileData.storageType === 'cloudinary' && fileData.url) {
            console.log('✅ Redirecting to Cloudinary URL:', fileData.url);
            return res.redirect(fileData.url);
        }
        
        // For local/memory files, serve the buffer
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', fileData.mimeType || 'image/jpeg');
        res.setHeader('Content-Length', fileData.size);
        
        console.log('✅ Sending passport file:', filename);
        res.send(fileData.buffer);
    } catch (error) {
        console.log('❌ File not found:', filename, error.message);
        
        // Get available files for debugging
        const availableFiles = await cloudStorage.listFiles('passportPhoto');
        
        return res.status(404).json({ 
            error: 'File not found',
            filename: filename,
            message: error.message,
            availableFiles: availableFiles.passports,
            storageInfo: cloudStorage.getStorageInfo()
        });
    }
});

router.get('/signatures/:filename', async (req, res) => {
    const filename = req.params.filename;
    console.log('🔍 Serving signature file:', { filename });
    
    try {
        const fileData = await cloudStorage.getFile(filename, 'signature');
        
        // If it's a Cloudinary file, redirect to the URL
        if (fileData.storageType === 'cloudinary' && fileData.url) {
            console.log('✅ Redirecting to Cloudinary URL:', fileData.url);
            return res.redirect(fileData.url);
        }
        
        // For local/memory files, serve the buffer
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', fileData.mimeType || 'image/jpeg');
        res.setHeader('Content-Length', fileData.size);
        
        console.log('✅ Sending signature file:', filename);
        res.send(fileData.buffer);
    } catch (error) {
        console.log('❌ File not found:', filename, error.message);
        
        // Get available files for debugging
        const availableFiles = await cloudStorage.listFiles('signature');
        
        return res.status(404).json({ 
            error: 'File not found',
            filename: filename,
            message: error.message,
            availableFiles: availableFiles.signatures,
            storageInfo: cloudStorage.getStorageInfo()
        });
    }
});

// Debug route to list available files
router.get('/debug/files', async (req, res) => {
    try {
        const files = await cloudStorage.listFiles();
        const storageInfo = cloudStorage.getStorageInfo();
        
        res.json({
            success: true,
            storage: storageInfo,
            passports: files.passports,
            signatures: files.signatures,
            totalPassports: files.passports.length,
            totalSignatures: files.signatures.length,
            total: files.total
        });
    } catch (error) {
        console.error('Error in debug/files:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            storageInfo: cloudStorage.getStorageInfo()
        });
    }
});

// Debug endpoint to check storage status and rate limits
router.get('/debug/status', async (req, res) => {
  try {
    const storageInfo = await cloudStorage.getStorageInfo();
    const rateLimitStatus = cloudStorage.getRateLimitStatus();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      storage: {
        ...storageInfo,
        rateLimit: rateLimitStatus
      },
      recommendations: getStorageRecommendations(storageInfo, rateLimitStatus)
    });
  } catch (error) {
    console.error('❌ Debug status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to provide storage recommendations
function getStorageRecommendations(storageInfo, rateLimitStatus) {
  const recommendations = [];
  
  if (rateLimitStatus.active) {
    recommendations.push({
      type: 'warning',
      message: `Rate limit recovery mode active. Time remaining: ${Math.round(rateLimitStatus.timeRemaining / 60000)} minutes`,
      action: 'System will automatically return to normal operation when rate limit resets'
    });
  }
  
  if (storageInfo.type === 'cloudinary' && storageInfo.isCloudDeployment) {
    recommendations.push({
      type: 'info',
      message: 'Cloudinary is configured but may hit rate limits on free tier',
      action: 'Consider upgrading Cloudinary plan or implementing local storage fallback'
    });
  }
  
  if (storageInfo.total === 0 || storageInfo.total === undefined) {
    recommendations.push({
      type: 'warning',
      message: 'No files found in storage',
      action: 'Check if files are being uploaded correctly and storage is configured properly'
    });
  }
  
  return recommendations;
}

module.exports = router; 
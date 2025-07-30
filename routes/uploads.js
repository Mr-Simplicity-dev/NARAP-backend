const express = require('express');
const router = express.Router();
const path = require('path');

// Serve uploaded files
router.get('/passports/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/passports', filename);
    console.log('🔍 Serving passport file:', { filename, filePath });
    
    // Check if file exists
    if (!require('fs').existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
});

router.get('/signatures/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/signatures', filename);
    console.log('🔍 Serving signature file:', { filename, filePath });
    
    // Check if file exists
    if (!require('fs').existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');

const multer = require('multer');
const {
  getCertificates,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  exportCertificates,
  importCertificates // Add this import
} = require('../controllers/certificateController');

const upload = multer({ storage: multer.memoryStorage() });

// Database wrapper for consistent error handling
const withDB = (handler) => {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }
  };
};

// Get all certificates
const getCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
    res.json(certificates);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ message: 'Server error while fetching certificates' });
  }
};

// Create certificate
const createCertificate = async (req, res) => {
  try {
    const {
      number,
      recipient,
      email,
      title,
      type = 'membership',
      description,
      issueDate,
      validUntil,
      userId
    } = req.body;
    
    // Validation
    if (!number || !recipient || !title) {
      return res.status(400).json({
        message: 'Certificate number, recipient, and title are required'
      });
    }
    
    // Check if certificate number already exists
    const existingCert = await Certificate.findOne({ 
      number: number.toUpperCase() 
    });
    if (existingCert) {
      return res.status(400).json({ 
        message: 'Certificate number already exists' 
      });
    }
    
    const certificateData = {
      number: number.toUpperCase().trim(),
      certificateNumber: number.toUpperCase().trim(), // Add certificateNumber field
      recipient: recipient.trim(),
      title: title.trim(),
      type,
      description: description?.trim(),
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      userId: userId || null
    };
    
    // Add email if provided
    if (email && email.trim()) {
      certificateData.email = email.toLowerCase().trim();
    }
    
    const certificate = new Certificate(certificateData);
    await certificate.save();
    
    res.status(201).json({
      message: 'Certificate issued successfully',
      certificate
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Certificate number already exists' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while issuing certificate' });
    }
  }
};

// Revoke certificate
const revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, revokedBy = 'Admin' } = req.body;
    
    console.log(`🚫 Revoking certificate ${id} with reason: ${reason}`);
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ message: 'Revocation reason is required' });
    }
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    if (certificate.status === 'revoked') {
      return res.status(400).json({ message: 'Certificate is already revoked' });
    }
    
    const updatedCertificate = await Certificate.findByIdAndUpdate(
      id,
      {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: revokedBy.trim(),
        revokedReason: reason.trim()
      },
      { new: true, runValidators: true }
    );
    
    console.log('✅ Certificate revoked successfully:', updatedCertificate.number);
    
    res.json({
      success: true,
      message: 'Certificate revoked successfully',
      certificate: updatedCertificate
    });
  } catch (error) {
    console.error('❌ Revoke certificate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while revoking certificate' 
    });
  }
};

// Restore certificate
const restoreCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    certificate.status = 'active';
    certificate.revokedAt = null;
    certificate.revokedBy = null;
    certificate.revokedReason = null;
    
    await certificate.save();
    
    res.json({
      success: true,
      message: 'Certificate restored successfully',
      certificate
    });
  } catch (error) {
    console.error('Restore certificate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while restoring certificate' 
    });
  }
};

// Delete certificate
const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting certificate ${id}`);
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Store certificate info before deletion for logging
    const certificateInfo = {
      number: certificate.number,
      recipient: certificate.recipient,
      title: certificate.title
    };
    
    await Certificate.findByIdAndDelete(id);
    
    console.log('✅ Certificate deleted successfully:', certificateInfo.number);
    
    res.json({ 
      success: true,
      message: 'Certificate deleted successfully',
      deletedCertificate: certificateInfo
    });
  } catch (error) {
    console.error('❌ Delete certificate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting certificate' 
    });
  }
};

// Bulk delete certificates
const bulkDeleteCertificates = async (req, res) => {
  try {
    const { certificateIds } = req.body;
    
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ message: 'Certificate IDs array is required' });
    }
    
    const result = await Certificate.deleteMany({
      _id: { $in: certificateIds }
    });
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} certificates`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete certificates error:', error);
    res.status(500).json({ message: 'Server error while deleting certificates' });
  }
};

// Search certificates
const searchCertificates = async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    let searchCriteria = {};
    
    // Text search across multiple fields
    if (query && query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchCriteria.$or = [
        { number: searchRegex },
        { recipient: searchRegex },
        { email: searchRegex },
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    
    // Apply filters
    if (filters.status) {
      searchCriteria.status = filters.status;
    }
    
    if (filters.type) {
      searchCriteria.type = filters.type;
    }
    
    if (filters.dateFrom) {
      searchCriteria.issueDate = { $gte: new Date(filters.dateFrom) };
    }
    
    if (filters.dateTo) {
      if (searchCriteria.issueDate) {
        searchCriteria.issueDate.$lte = new Date(filters.dateTo);
      } else {
        searchCriteria.issueDate = { $lte: new Date(filters.dateTo) };
      }
    }
    
    const certificates = await Certificate.find(searchCriteria)
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({
      certificates,
      count: certificates.length,
      query,
      filters
    });
  } catch (error) {
    console.error('Certificate search error:', error);
    res.status(500).json({ message: 'Server error while searching certificates' });
  }
};


// Export certificates
const exportCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
    // Convert to CSV format
    const csvHeader = 'Certificate Number,Recipient,Email,Title,Type,Status,Issue Date,Valid Until,Issued By\n';
    const csvData = certificates.map(cert => {
      return [
        cert.number,
        cert.recipient,
        cert.email,
        cert.title,
        cert.type,
        cert.status,
        cert.issueDate ? cert.issueDate.toISOString().split('T')[0] : '',
        cert.validUntil ? cert.validUntil.toISOString().split('T')[0] : '',
        cert.issuedBy
      ].join(',');
    }).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=narap_certificates.csv');
    res.send(csvHeader + csvData);
  } catch (error) {
    console.error('Export certificates error:', error);
    res.status(500).json({ message: 'Server error while exporting certificates' });
  }
};

// Verify certificate (public)
const verifyCertificate = async (req, res) => {
  try {
    const { certificateNumber } = req.body;
    
    console.log('🔍 Frontend certificate verification request for:', certificateNumber);
    
    if (!certificateNumber) {
      return res.status(400).json({ 
        success: false,
        message: 'Certificate number is required' 
      });
    }
    
    // Search for certificate by number (case insensitive)
    const certificate = await Certificate.findOne({ 
      number: { $regex: new RegExp(`^${certificateNumber}$`, 'i') }
    }).populate('userId', 'name email code');
    
    if (!certificate) {
      console.log('❌ Certificate not found for number:', certificateNumber);
      return res.status(404).json({ 
        success: false,
        message: 'Certificate not found with this number. Please verify the certificate number and try again.' 
      });
    }
    
    // Check if certificate is expired
    let status = certificate.status;
    if (certificate.validUntil && new Date() > certificate.validUntil && status === 'active') {
      status = 'expired';
      certificate.status = 'expired';
      await certificate.save();
    }
    
    console.log('✅ Certificate found:', certificate.number, status);
    
    res.json({
      success: true,
      message: 'Certificate verified successfully',
      certificate: {
        _id: certificate._id,
        certificateNumber: certificate.number,
        recipientName: certificate.recipient,
        title: certificate.title,
        type: certificate.type,
        description: certificate.description,
        dateIssued: certificate.issueDate || certificate.createdAt,
        validUntil: certificate.validUntil,
        status: status,
        issuedBy: certificate.issuedBy || 'NARAP Authority',
        revokedAt: certificate.revokedAt,
        revokedReason: certificate.revokedReason
      }
    });
  } catch (error) {
    console.error('❌ Certificate verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while verifying certificate' 
    });
  }
};

// Routes
router.get('/', withDB(getCertificates));
router.post('/', withDB(createCertificate));
router.put('/:id/revoke', withDB(revokeCertificate));
router.put('/:id/restore', withDB(restoreCertificate));
router.delete('/:id', withDB(deleteCertificate));
router.post('/bulk-delete', withDB(bulkDeleteCertificates));
router.post('/search', withDB(searchCertificates));
router.get('/export', withDB(exportCertificates));
router.post('/import', upload.single('file'), withDB(importCertificates));

// Public routes (no authentication required)
router.post('/verify', withDB(verifyCertificate));

module.exports = router; 

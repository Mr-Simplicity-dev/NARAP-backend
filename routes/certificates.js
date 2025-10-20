const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const User = require('../models/User'); 
const { canAddCertificate } = require('../utils/limitsChecker');

const multer = require('multer');
// const {
//   getCertificates,
//   createCertificate,
//   updateCertificate,
//   deleteCertificate,
//   exportCertificates,
//   importCertificates // Add this import
// } = require('../controllers/certificateController');

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

// Create certificate (upsert by number)
const createCertificate = async (req, res) => {
  try {
    const {
      number,
      recipient,
      email,
      title,
      position,
      type = 'membership',
      description,
      issueDate,
      validUntil,
      expiryDate,
      userId
    } = req.body;

    // ✅ Validation: require number, recipient, issueDate
    if (!number || !recipient || !issueDate) {
      return res.status(400).json({
        message: 'Certificate number, recipient, and issueDate are required'
      });
    }

    const normalizedNumber = String(number).toUpperCase().trim();

    // Look up existing certificate
    const existingCert = await Certificate.findOne({ number: normalizedNumber });

    // 🛡️ Only check limits if creating a new certificate (not updating)
    if (!existingCert) {
      const limitCheck = await canAddCertificate();
      if (!limitCheck.allowed) {
        console.log('❌ Certificate limit reached:', limitCheck.message);
        return res.status(429).json({
          success: false,
          message: limitCheck.message,
          error: 'CERTIFICATE_LIMIT_REACHED',
          details: {
            currentCount: limitCheck.currentCount,
            limit: limitCheck.limit
          }
        });
      }
      console.log('✅ Certificate limit check passed:', limitCheck.message);
    }

    

    // Prepare fields (title optional; fallback to position or 'Membership')
    const titleFinal =
      (title && String(title).trim()) ||
      (position && String(position).trim()) ||
      'Membership';

    const validUntilFinal = validUntil || expiryDate || null;

    const certificateData = {
      number: normalizedNumber,
      certificateNumber: normalizedNumber,
      recipient: String(recipient).trim(),
      title: titleFinal,
      type,
      description: description ? String(description).trim() : '',
      issueDate: new Date(issueDate),
      validUntil: validUntilFinal ? new Date(validUntilFinal) : null,
      userId: userId || null
    };

    if (email && String(email).trim()) {
      certificateData.email = String(email).toLowerCase().trim();
    }

    // ✅ Upsert behavior: update if exists, else create
    if (existingCert) {
      Object.assign(existingCert, certificateData);
      await existingCert.save();
      return res.status(200).json({
        message: 'Certificate updated successfully',
        updated: true,
        certificate: existingCert
      });
    }

    const certificate = new Certificate(certificateData);
    await certificate.save();

    return res.status(201).json({
      message: 'Certificate issued successfully',
      created: true,
      certificate
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    if (error.code === 11000) {
      // Duplicate key (should be rare now that we upsert, but kept for safety)
      return res.status(400).json({ message: 'Certificate number already exists' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    return res.status(500).json({ message: 'Server error while issuing certificate' });
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

// Bulk delete certificates (accepts ids and/or numbers; supports multiple payload shapes)
const bulkDeleteCertificates = async (req, res) => {
  try {
    // Normalize payload from various frontends:
    //  - ids / certificateIds / _ids
    //  - numbers / certificateNumbers / codes / number / certificateNumber
    const toArray = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));
    const uniq = (arr) => Array.from(new Set(arr));
    const isObjectId = (s) => typeof s === 'string' && mongoose.Types.ObjectId.isValid(s);

    const rawIds = [
      ...toArray(req.body?.ids),
      ...toArray(req.body?.certificateIds),
      ...toArray(req.body?._ids),
    ];

    const rawNumbers = [
      ...toArray(req.body?.numbers),
      ...toArray(req.body?.certificateNumbers),
      ...toArray(req.body?.codes),
      ...toArray(req.body?.number),
      ...toArray(req.body?.certificateNumber),
    ];

    const ids = uniq(rawIds.filter(isObjectId).map(String));
    const numbers = uniq(
      rawNumbers
        .map((x) => (x == null ? '' : String(x)))
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toUpperCase()) // keep numbers case-insensitive
    );

    if (!ids.length && !numbers.length) {
      return res.status(400).json({
        message: 'Provide ids[] and/or numbers[]',
        receivedKeys: Object.keys(req.body || {}),
      });
    }

    // Build the query; OR by _id and number
    const or = [];
    if (ids.length) or.push({ _id: { $in: ids } });
    if (numbers.length) or.push({ number: { $in: numbers } });

    const query = or.length === 1 ? or[0] : { $or: or };

    const result = await Certificate.deleteMany(query);

    return res.json({
      message: `Successfully deleted ${result.deletedCount || 0} certificate(s)`,
      deletedCount: result.deletedCount || 0,
      matchedBy: { ids, numbers },
    });
  } catch (error) {
    console.error('Bulk delete certificates error:', error);
    return res.status(500).json({
      message: 'Server error while deleting certificates',
      error: String(error?.message || error),
    });
  }
};


// Search certificates
const searchCertificates = async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    let searchCriteria = {};

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

// ✅ FIXED: Robust(er) CSV import (keeps your style; minimal changes)

const importCertificates = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded'
      });
    }

    const csvData = req.file.buffer.toString('utf8');
    const lines = csvData.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'CSV appears empty or has no data rows'
      });
    }

    // Header handling (strip BOM)
    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const rawHeaders = headerLine.split(',').map(h => String(h || '').trim().toLowerCase());

    // Aliases
    const aliases = {
      number: ['certificate number','certificatenumber','certificateid','certificate id','number','cert no','cert no.'],
      recipient: ['recipient','name','member_name','member','recipient name'],
      email: ['email','email_address','e-mail','mail'],
      title: ['title','position','role'],
      type: ['type'],
      status: ['status'],
      issueDate: ['issue date','issue_date','issuedate','date_issued','date issue','issued on','issued'],
      validUntil: ['valid until','expiry date','expiry','expiry_date','expirydate','date_expiry','date expiry'],
      issuedBy: ['issued by','issuer','authorizing body']
    };

    const findIdx = (key) => {
      const opts = [key].concat(aliases[key] || []);
      for (const k of opts) {
        const idx = rawHeaders.indexOf(String(k).toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const col = {
      number: findIdx('number'),
      recipient: findIdx('recipient'),
      email: findIdx('email'),
      title: findIdx('title'),
      type: findIdx('type'),
      status: findIdx('status'),
      issueDate: findIdx('issueDate'),
      validUntil: findIdx('validUntil'),
      issuedBy: findIdx('issuedBy')
    };

    // Minimal required
    const missing = [];
    if (col.number === -1) missing.push('Certificate Number');
    if (col.recipient === -1) missing.push('Recipient');
    if (col.issueDate === -1) missing.push('Issue Date');
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV format. Missing required columns: ' + missing.join(', ')
      });
    }

    const results = { imported: 0, updated: 0, processed: 0, errors: [] };

    for (const line of lines.slice(1)) {
      const parts = line.split(',').map(s => (s || '').trim());
      if (parts.length === 0 || parts.every(p => !p)) continue;

      const rawNumber = parts[col.number] || '';
      const recipient = parts[col.recipient] || '';
      const email = (col.email > -1 ? parts[col.email] : '').toLowerCase();
      const title = (col.title > -1 ? parts[col.title] : '');
      const type = (col.type > -1 ? parts[col.type] : 'membership');
      const status = (col.status > -1 ? parts[col.status] : 'active').toLowerCase();
      const issueDateStr = parts[col.issueDate] || '';
      const validUntilStr = (col.validUntil > -1 ? parts[col.validUntil] : '');
      const issuedBy = (col.issuedBy > -1 ? parts[col.issuedBy] : '');

      const number = rawNumber.toUpperCase().trim();
      if (!number || !recipient || !issueDateStr) {
        results.errors.push({ row: parts, reason: 'Missing required fields (Certificate Number, Recipient, Issue Date)' });
        continue;
      }

      const issueDate = new Date(issueDateStr);
      const validUntil = validUntilStr ? new Date(validUntilStr) : null;

      // Try to link user by email if present
      let user = null;
      if (email) {
        user = await User.findOne({ $or: [{ email }, { code: email }] }).select('_id');
      }

      const existing = await Certificate.findOne({ number }).select('_id');

      const certificateData = {
        number,
        certificateNumber: number,
        recipient,
        email: email || undefined,
        title: title || 'Membership',
        type,
        status: status || 'active',
        issueDate: issueDate || undefined,
        validUntil: validUntil || null,
        issuedBy: issuedBy || undefined,
        userId: user?._id || null,
        lastUpdated: new Date()
      };

      await Certificate.findOneAndUpdate(
        { number },
        { $set: certificateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (existing) results.updated++;
      else results.imported++;

      results.processed++;
    }

    return res.json({
      success: true,
      message: `Import completed: ${results.imported} new, ${results.updated} updated.`,
      summary: { processed: results.processed, errors: results.errors.slice(0, 10) }
    });
  } catch (error) {
    console.error('❌ Certificate import error:', error);
    res.status(500).json({
      success: false,
      message: 'Import failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
;

// Export certificates
const exportCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });

    const csvHeader = 'Certificate Number,Recipient,Email,Title,Type,Status,Issue Date,Valid Until,Issued By\n';
    const csvData = certificates.map(cert => {
      return [
        cert.number,
        cert.recipient,
        cert.email || '',
        cert.title || '',
        cert.type || '',
        cert.status || '',
        cert.issueDate ? cert.issueDate.toISOString().split('T')[0] : '',
        cert.validUntil ? cert.validUntil.toISOString().split('T')[0] : '',
        cert.issuedBy || ''
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
router.post('/import', upload.single('file'), withDB(importCertificates)); // expects 'file' field

// Public routes (no authentication required)
router.post('/verify', withDB(verifyCertificate));

module.exports = router;

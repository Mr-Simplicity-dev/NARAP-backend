// --- auto-added imports ---
const multer = require('multer');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cloudStorage = require('./cloud-storage');
const path = require('path');
require('dotenv').config();


// Multer memory storage for small files (passport/signature)
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'X-File-Name', 'X-HTTP-Method-Override'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly for all routes
app.options('*', cors());

// ✅ Rate limiting AFTER CORS so 429 responses include CORS headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req, res) => req.method === 'GET'
});
app.use('/api/', limiter);



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

// --- Email placeholder handling (make email optional) ---
const PLACEHOLDER_EMAIL_RE = /^(nill|null|n\/a|na|none|nil|\-|\s*)$/i;
function normalizeEmailField(obj){
  if (obj && Object.prototype.hasOwnProperty.call(obj, 'email')) {
    const t = String(obj.email ?? '').trim();
    if (!t || PLACEHOLDER_EMAIL_RE.test(t)) {
      delete obj.email; // treat as optional
    }
  }
}
// Normalize email on all /api/users requests (works for urlencoded/multipart because fields land in req.body)
app.use('/api/users', (req, res, next) => {
  try { if (req.body) normalizeEmailField(req.body); } catch(_) {}
  next();
});


// --- State normalization for members (ensure backend reflects changes) ---
const STATE_LIST = [
  "ABIA","ADAMAWA","AKWA IBOM","ANAMBRA","BAUCHI","BAYELSA","BENUE","BORNO",
  "CROSS RIVER","DELTA","EBONYI","EDO","EKITI","ENUGU","FCT","GOMBE","IMO",
  "JIGAWA","KADUNA","KANO","KATSINA","KEBBI","KOGI","KWARA","LAGOS",
  "NASARAWA","NIGER","OGUN","ONDO","OSUN","OYO","PLATEAU","RIVERS",
  "SOKOTO","TARABA","YOBE","ZAMFARA"
];

const STATE_ALIASES = {
  "ABUJA":"FCT",
  "F.C.T":"FCT",
  "FCT-ABUJA":"FCT",
  "ABJ":"FCT",
  "CROSSRIVER":"CROSS RIVER",
  "AKWAIBOM":"AKWA IBOM"
};

function normalizeStateField(obj){
  if (!obj) return;
  // support both `state` and `State`
  const key = Object.prototype.hasOwnProperty.call(obj, 'state') ? 'state'
            : (Object.prototype.hasOwnProperty.call(obj, 'State') ? 'State' : null);
  if (!key) return;

  let value = String(obj[key] ?? '').trim();
  if (!value) return;

  let up = value.toUpperCase();
  // remove dots/spaces for alias lookup
  const compact = up.replace(/\./g,'').replace(/\s+/g,'');

  if (STATE_ALIASES[up]) up = STATE_ALIASES[up];
  else if (STATE_ALIASES[compact]) up = STATE_ALIASES[compact];

  // If not an exact match, try forgiving match by collapsing spaces
  if (!STATE_LIST.includes(up)){
    const found = STATE_LIST.find(s => s.replace(/\s+/g,'') === compact);
    if (found) up = found;
  }

  // Final fallback: keep uppercase string even if it's not in list
  obj[key] = up;
}

// Normalize state on all /api/users requests (create/update)
app.use('/api/users', (req, res, next) => {
  try {
    if (req.body) {
      normalizeStateField(req.body);
      // also normalize in nested structures we commonly see
      if (req.body.address && typeof req.body.address === 'object') normalizeStateField(req.body.address);
      if (req.body.profile && typeof req.body.profile === 'object') normalizeStateField(req.body.profile);
    }
  } catch(_){}
  next();
});


// --- Certificate code sync when member state changes (ABIA->KADUNA etc.) ---
const STATE_CODES = {
  "ABIA": "ABI","ADAMAWA": "ADA","AKWA IBOM": "AKW","ANAMBRA": "ANA","BAUCHI": "BAU",
  "BAYELSA": "BAY","BENUE": "BEN","BORNO": "BOR","CROSS RIVER": "CRS","DELTA": "DEL",
  "EBONYI": "EBO","EDO": "EDO","EKITI": "EKI","ENUGU": "ENU","FCT": "FCT","GOMBE": "GOM",
  "IMO": "IMO","JIGAWA": "JIG","KADUNA": "KAD","KANO": "KAN","KATSINA": "KAT","KEBBI": "KEB",
  "KOGI": "KOG","KWARA": "KWA","LAGOS": "LAG","NASARAWA": "NAS","NIGER": "NIG","OGUN": "OGU",
  "ONDO": "OND","OSUN": "OSU","OYO": "OYO","PLATEAU": "PLA","RIVERS": "RIV","SOKOTO": "SOK",
  "TARABA": "TAR","YOBE": "YOB","ZAMFARA": "ZAM"
};

/**
 * Replace the middle segment /OLD/ with /NEW/ in codes like N/012/OLD/002.
 * Works for fields: number, certificateNumber (if present).
 */
async function syncCertificatesForStateChange(userId, oldState, newState) {
  try {
    const oldCode = STATE_CODES[String(oldState).toUpperCase()] || String(oldState).substring(0,3).toUpperCase();
    const newCode = STATE_CODES[String(newState).toUpperCase()] || String(newState).substring(0,3).toUpperCase();
    if (!oldCode || !newCode || oldCode === newCode) return;

    // Prefer pipeline updates if supported
    try {
      const pipeline = [
        {
          $set: {
            number: {
              $cond: [
                { $and: [ { $ifNull: ["$number", false] }, { $regexMatch: { input: "$number", regex: new RegExp(`/` + oldCode + `/`) } } ] },
                { $replaceAll: { input: "$number", find: "/" + oldCode + "/", replacement: "/" + newCode + "/" } },
                "$number"
              ]
            },
            certificateNumber: {
              $cond: [
                { $and: [ { $ifNull: ["$certificateNumber", false] }, { $regexMatch: { input: "$certificateNumber", regex: new RegExp(`/` + oldCode + `/`) } } ] },
                { $replaceAll: { input: "$certificateNumber", find: "/" + oldCode + "/", replacement: "/" + newCode + "/" } },
                "$certificateNumber"
              ]
            }
          }
        }
      ];
      if (typeof Certificate !== 'undefined' && Certificate && typeof Certificate.updateMany === 'function') {
        await Certificate.updateMany({ userId }, pipeline);
        return;
      }
    } catch (e) {
      // fall through to manual update if pipeline not supported
    }

    // Fallback: manual JS loop
    if (typeof Certificate !== 'undefined' && Certificate && typeof Certificate.find === 'function') {
      const certs = await Certificate.find({ userId });
      for (const c of certs) {
        let dirty = false;
        if (typeof c.number === 'string' && c.number.includes("/"+oldCode+"/")) {
          c.number = c.number.replace("/"+oldCode+"/", "/"+newCode+"/");
          dirty = true;
        }
        if (typeof c.certificateNumber === 'string' && c.certificateNumber.includes("/"+oldCode+"/")) {
          c.certificateNumber = c.certificateNumber.replace("/"+oldCode+"/", "/"+newCode+"/");
          dirty = true;
        }
        if (dirty && typeof c.save === 'function') await c.save();
      }
    }
  } catch (err) {
    console.error("Certificate sync error:", err);
  }
}

// Override PUT/PATCH user update to apply certificate sync when state changes.
// IMPORTANT: place BEFORE 
// ---- Unified update handler for users (PUT/PATCH/POST) ----
// Unified update core for all update endpoints
async function _updateUserCore(req, res, next) {
  try {
    // Accept id from params OR body (for /api/users/update)
    const id =
      (req.params && req.params.id) ||
      (req.body && (req.body.id || req.body._id));

    if (!id) {
      return res.status(400).json({ message: 'Missing user id' });
    }

    const updateData = { ...(req.body || {}) };

    console.log('🔄 Update user request:', { id, fields: Object.keys(updateData) });
    console.log('📁 Files received:', !!req.files, Object.keys(req.files || {}));

    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove sensitive/uneditable fields
    delete updateData.password;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Normalize state if helper exists
    try {
      if (typeof normalizeStateField === 'function') {
        normalizeStateField(updateData);
      }
    } catch (_) {}

    // Enforce code format & uniqueness if changed
    if (updateData.code) {
      updateData.code = String(updateData.code).toUpperCase().trim();
      const exists = await User.findOne({ code: updateData.code, _id: { $ne: id } });
      if (exists) {
        return res.status(400).json({ message: 'Code already exists' });
      }
    }

    // Handle passport photo file
    if (req.files?.passportPhoto?.[0]) {
      try {
        if (existingUser.passportPhoto) {
          await cloudStorage.deleteFile(existingUser.passportPhoto, 'passportPhoto');
          console.log('🗑️ Deleted old passport photo:', existingUser.passportPhoto);
        }
        const passportFile = req.files.passportPhoto[0];
        const saved = await cloudStorage.saveFile(passportFile, 'passportPhoto');
        updateData.passportPhoto = saved.filename;
        // backward-compat field
        updateData.passport = saved.filename;
        console.log('✅ New passport photo saved:', saved.filename);
      } catch (e) {
        console.error('❌ Error updating passport photo:', e);
        return res.status(500).json({ message: 'Failed to update passport photo' });
      }
    }

    // Handle signature file
    if (req.files?.signature?.[0]) {
      try {
        if (existingUser.signature) {
          await cloudStorage.deleteFile(existingUser.signature, 'signature');
          console.log('🗑️ Deleted old signature:', existingUser.signature);
        }
        const signFile = req.files.signature[0];
        const saved2 = await cloudStorage.saveFile(signFile, 'signature');
        updateData.signature = saved2.filename;
        console.log('✅ New signature saved:', saved2.filename);
      } catch (e) {
        console.error('❌ Error updating signature:', e);
        return res.status(500).json({ message: 'Failed to update signature' });
      }
    }

    // If both images will exist post-update, mark cardGenerated = true
    const willHavePassport = updateData.passportPhoto || existingUser.passportPhoto;
    const willHaveSignature = updateData.signature || existingUser.signature;
    if (willHavePassport && willHaveSignature) {
      updateData.cardGenerated = true;
    }

    // Do the update
    const updated = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Side-effect: sync certificates if state changed
    try {
      const oldState = (existingUser.state || existingUser.State || '').toString().toUpperCase();
      const newState = (updated.state || updated.State || '').toString().toUpperCase();
      if (oldState && newState && oldState !== newState) {
        await syncCertificatesForStateChange(id, oldState, newState);
      }
    } catch (e) {
      console.warn('state-change sync warning:', e?.message || e);
    }

    console.log('✅ User updated:', { id: updated._id, name: updated.name, code: updated.code });
    // Return raw updated user object for frontend compatibility
    return res.json(updated);

  } catch (err) {
    console.error('User update handler error:', err);
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'Duplicate entry found' });
    }
    if (err?.name === 'ValidationError') {
      const msgs = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ message: msgs.join(', ') || 'Validation error' });
    }
    return res.status(500).json({ message: 'Server error updating user' });
  }
}



// --- Update endpoints BEFORE userRoutes to ensure they catch updates ---
// --- Compatibility update endpoints (older clients expect these) ---
app.post('/api/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.put('/api/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.patch('/api/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);

app.put('/api/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);
app.patch('/api/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);

// Non-API variants some clients try (keep after /api/* but before userRoutes)
app.post('/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.put('/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.patch('/users/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);

app.post('/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);
app.put('/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);
app.patch('/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);

// Preflight for CORS
app.options('/api/users/:id', (req,res)=>res.sendStatus(204));
app.options('/api/users/update', (req,res)=>res.sendStatus(204));
app.options('/users/:id', (req,res)=>res.sendStatus(204));
app.options('/users/update', (req,res)=>res.sendStatus(204));

app.put('/api/users/updateUser/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.patch('/api/users/updateUser/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);
app.post('/api/users/updateUser/:id', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), _updateUserCore);        // accept plain POST for updates
app.post('/api/users/update', upload.fields([{ name:'passportPhoto', maxCount:1 }, { name:'signature', maxCount:1 }]), (req,res,next)=>{ if(!req.params) req.params={}; if(!req.params.id) req.params.id = req.body?.id || req.body?._id; next(); }, _updateUserCore);     // accept POST with body.id for updates


app.use('/api/users', userRoutes);

app.put('/api/users/updateUser/:id', async (req, res, next) => {
  try {
    // If body is empty (e.g., multipart handled later), delegate to original userRoutes
    if (!req.body || Object.keys(req.body).length === 0) return next();

    const id = req.params.id;
    const prev = await User.findById(id);
    if (!prev) return res.status(404).json({ message: 'User not found' });

    const nextData = req.body || {};
    try { if (typeof normalizeStateField === 'function') normalizeStateField(nextData); } catch(_){}

    let updated = await User.findByIdAndUpdate(id, nextData, { new: true });
    if (!updated) return res.status(500).json({ message: 'Update failed' });

    const oldState = (prev.state || prev.State || '').toString().toUpperCase();
    const newState = (updated.state || updated.State || '').toString().toUpperCase();
    if (oldState && newState && oldState !== newState) {
      await syncCertificatesForStateChange(id, oldState, newState);
    }

    return res.json(updated);
  } catch (err) {
    console.error('PUT /api/users/:id error:', err);
    return res.status(500).json({ message: 'Server error updating user' });
  }
});


app.patch('/api/users/updateUser/:id', async (req, res, next) => {
  try {
    // If body is empty (e.g., multipart handled later), delegate to original userRoutes
    if (!req.body || Object.keys(req.body).length === 0) return next();

    const id = req.params.id;
    const prev = await User.findById(id);
    if (!prev) return res.status(404).json({ message: 'User not found' });

    const nextData = req.body || {};
    try { if (typeof normalizeStateField === 'function') normalizeStateField(nextData); } catch(_){}

    let updated = await User.findByIdAndUpdate(id, nextData, { new: true });
    if (!updated) return res.status(500).json({ message: 'Update failed' });

    const oldState = (prev.state || prev.State || '').toString().toUpperCase();
    const newState = (updated.state || updated.State || '').toString().toUpperCase();
    if (oldState && newState && oldState !== newState) {
      await syncCertificatesForStateChange(id, oldState, newState);
    }

    return res.json(updated);
  } catch (err) {
    console.error('PATCH /api/users/:id error:', err);
    return res.status(500).json({ message: 'Server error updating user' });
  }
});



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

// ===== Activity endpoints (MongoDB-backed, persistent) =====
// ===== Activity live stream (SSE) =====
const __activityClients = new Set();
function __broadcastActivity(act){
  try {
    const payload = `data: ${JSON.stringify(act)}\n\n`;
    for (const res of __activityClients) {
      try { res.write(payload); } catch(_){}
    }
  } catch(_){}
}
app.get('/api/activity/stream', (req, res) => {
  try {
    res.set({
      'X-Accel-Buffering': 'no', 'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders && res.flushHeaders();
    res.write('retry: 5000\n\n');
    __activityClients.add(res);
    // Heartbeat every 20s to avoid QUIC idle timeout
    const __hb = setInterval(() => { try { res.write(':ka\n\n'); } catch(_) {} }, 20000);
    const __cleanup = () => { try { clearInterval(__hb); } catch(_) {} try { __activityClients.delete(res); } catch(_) {} };
    req.on('close', __cleanup);
    req.on('end', __cleanup);
    req.on('close', () => { __activityClients.delete(res); });
  } catch (err) {
    console.error('SSE error:', err);
    try { res.end(); } catch(_){}
  }
});
// ===== End Activity live stream =====

(() => {
  // Use existing mongoose connection if available
  const mongoose = require('mongoose');

  // Define Activity schema/model once
  const ActivitySchema = new mongoose.Schema({
    ts: { type: Date, default: Date.now, index: true },
    date: { type: String },
    time: { type: String },
    entity: { type: String, default: 'system', index: true },
    action: { type: String, default: 'unknown', index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  }, { timestamps: false, strict: false });

  // Avoid OverwriteModelError if reloaded
  const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);

  // GET /api/activity?limit=50
  app.get('/api/activity', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const items = await Activity.find({})
        .sort({ ts: -1, _id: -1 })
        .limit(Math.max(1, Math.min(limit, 200)))
        .lean()
        .exec();
      return res.json(items);
    } catch (err) {
      console.error('Activity GET error:', err);
      res.status(500).json({ success:false, message:'Failed to fetch activity log' });
    }
  });

  // POST /api/activity
  app.post('/api/activity', async (req, res) => {
    try {
      const entry = req.body || {};
      const now = new Date();
      const activity = {
        ts: entry.ts ? new Date(entry.ts) : now,
        date: entry.date || now.toLocaleDateString(),
        time: entry.time || now.toLocaleTimeString(),
        entity: entry.entity || 'system',
        action: entry.action || 'unknown',
        data: entry.data || {},
      };
      const saved = await Activity.create(activity);
      __broadcastActivity(saved);
      return res.json({ success:true, data: saved });
    } catch (err) {
      console.error('Activity POST error:', err);
      res.status(500).json({ success:false, message:'Failed to log activity' });
    }
  });
})();
// ===== End Activity endpoints =====
// 404 handler

// Lightweight lookup: check if a user exists by code or email (no multipart parsing needed)
app.get('/api/users/exists', async (req, res) => {
  try {
    const User = require('./models/User');
    const { code, email } = req.query;
    if (!code && !email) {
      return res.status(400).json({ success: false, message: 'Provide code or email' });
    }
    const query = [];
    if (code) query.push({ code: String(code).trim() });
    if (email) query.push({ email: String(email).trim() });
    const user = await User.findOne({ $or: query }).select('_id code email');
    if (user) {
      return res.json({ success: true, exists: true, id: String(user._id), code: user.code, email: user.email });
    }
    return res.json({ success: true, exists: false });
  } catch (err) {
    console.error('exists lookup error:', err);
    return res.status(500).json({ success: false, message: 'Lookup failed' });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: ['/api/auth','/api/users','/api/certificates','/api/analytics','/api/uploads','/api/health','/api/activity','/api/activity/stream']
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

// Clear all certificates function
async function clearAllCertificates() {
  try {
    console.log('🗑️ Clearing all certificates...');
    const Certificate = require('./models/Certificate');
    
    // Clear all certificates
    const certificateResult = await Certificate.deleteMany({});
    console.log(`✅ Deleted ${certificateResult.deletedCount} certificates`);
    
    console.log(`✅ Certificates cleared successfully. Total certificates deleted: ${certificateResult.deletedCount}`);
    
    return {
      certificatesDeleted: certificateResult.deletedCount
    };
  } catch (error) {
    console.error('❌ Error clearing certificates:', error);
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

// Clear all certificates endpoint
app.post('/api/clear-certificates', async (req, res) => {
  try {
    const result = await clearAllCertificates();
    res.json({
      success: true,
      message: `Successfully cleared certificates. Deleted ${result.certificatesDeleted} certificates`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear certificates',
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
    
          // Initialize cloud storage
      console.log('🔧 Initializing storage system...');
      const storageInfo = cloudStorage.getStorageInfo();
      console.log('📊 Storage info:', storageInfo);
    
    app.listen(PORT, () => {
      console.log(`🚀 NARAP Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`📝 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📁 Storage type: ${storageInfo.type} (Cloud: ${storageInfo.isCloudDeployment})`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  
  // Log additional details if available
  if (reason instanceof Error) {
    console.error('Stack trace:', reason.stack);
  }
  
  // Don't exit the process, just log the error
  // This prevents the server from crashing due to unhandled rejections
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:');
  console.error('Error:', error.message);
  console.error('Stack trace:', error.stack);
  
  // For uncaught exceptions, we should exit the process
  // But give it a chance to clean up first
  setTimeout(() => {
    console.error('🛑 Forcing process exit due to uncaught exception');
    process.exit(1);
  }, 1000);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

// Start the server
startServer(); 
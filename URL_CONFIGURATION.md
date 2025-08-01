# 🔗 URL Configuration Documentation

## 📋 **Overview**
This document tracks all URL configurations in the NARAP backend and frontend codebase to ensure consistency and proper deployment.

## 🎯 **Production Backend URL**
**Primary URL**: `https://narap-backend.onrender.com`

## 📁 **Backend Files Configuration**

### ✅ **Correctly Configured Files**

#### **Test Scripts**
- `test-cloudinary.js` - Uses production URL
- `test-delete-update-cloudinary.js` - Uses production URL  
- `test-new-upload.js` - Uses production URL
- `test-password-clear.js` - Uses production URL
- `test-photo-display.js` - Uses production URL
- `test-cloud-deployment.js` - Uses environment variable with production fallback
- `quick-test.js` - Uses production URL
- `debug-storage.js` - Uses production URL
- `simple-test.js` - Uses production URL

#### **Routes**
- `routes/users.js` - Dynamic URL construction with environment variable fallback
- `routes/uploads.js` - Properly configured for Cloudinary integration

#### **Server Configuration**
- `server.js` - CORS properly configured for both development and production

### 🔧 **Recently Fixed Files**

#### **Test Scripts**
- `test-backend.js` - ✅ **FIXED**: Now uses environment variable with production fallback
- `test-photo-uploads.js` - ✅ **FIXED**: Now uses environment variable with production fallback

## 🌐 **Frontend Files Configuration**

### ✅ **Correctly Configured Files**

#### **Main Application**
- `NARAP/js/admin.js` - Uses production URL with localStorage override capability
- `NARAP/index.html` - Uses production URL with localStorage override capability
- `NARAP/test-photo-frontend.html` - Uses production URL
- `NARAP/test-photo-debug.html` - Uses production URL

#### **Documentation**
- `NARAP/README.md` - Documents both development and production URLs
- `NARAP/FRONTEND_DEPLOYMENT_GUIDE.md` - Proper URL documentation

## 🔧 **Environment Variable Support**

### **Backend Environment Variables**
```bash
# Optional: Override backend URL for testing
BACKEND_URL=https://narap-backend.onrender.com

# Required: MongoDB connection
MONGO_URI=your_mongodb_connection_string

# Optional: Cloudinary configuration
CLOUDINARY_CLOUD_NAME=NARAP_IMAGES
CLOUDINARY_API_KEY=219556848713984
CLOUDINARY_API_SECRET=243__4G0WJVVPXmUULxAcZdjPJg
```

### **Frontend Environment Variables**
```bash
# Optional: Override backend URL
BACKEND_URL=https://narap-backend.onrender.com
```

## 🚀 **URL Construction Logic**

### **Backend Routes (Dynamic)**
```javascript
// In routes/users.js
const baseUrl = process.env.BACKEND_URL || 
  `${req.protocol}://${req.get('host')}` || 
  'https://narap-backend.onrender.com';
```

### **Frontend (Production Default)**
```javascript
// In admin.js and index.html
function getBackendUrl() {
  const customBackendUrl = localStorage.getItem('narap_backend_url');
  if (customBackendUrl) {
    return customBackendUrl;
  }
  return 'https://narap-backend.onrender.com';
}
```

### **Test Scripts (Environment Variable Support)**
```javascript
// In test scripts
const BACKEND_URL = process.env.BACKEND_URL || 'https://narap-backend.onrender.com';
```

## 🔒 **CORS Configuration**

### **Allowed Origins**
```javascript
const allowedOrigins = [
  'https://narapdb.com.ng',
  'http://narapdb.com.ng', 
  'https://www.narapdb.com.ng',
  'http://www.narapdb.com.ng',
  'http://localhost:3000',      // Development
  'http://localhost:5173',      // Development
  'https://localhost:3000',     // Development
  'https://localhost:5173',     // Development
  'http://localhost:5000',      // Development
  'https://localhost:5000'      // Development
];
```

## 📊 **URL Usage Summary**

| Component | URL Type | Configuration | Status |
|-----------|----------|---------------|---------|
| Production Backend | Primary | `https://narap-backend.onrender.com` | ✅ Active |
| Development Backend | Local | `http://localhost:5000` | ✅ Supported |
| Frontend Production | Primary | `https://narapdb.com.ng` | ✅ Active |
| Frontend Development | Local | `http://localhost:3000` | ✅ Supported |
| Test Scripts | Dynamic | Environment variable + fallback | ✅ Fixed |
| API Routes | Dynamic | Request-based + environment fallback | ✅ Updated |

## 🧪 **Testing URLs**

### **Health Check**
```bash
# Production
curl https://narap-backend.onrender.com/api/health

# Development
curl http://localhost:5000/api/health
```

### **File Upload Test**
```bash
# Production
curl -X POST https://narap-backend.onrender.com/api/users/addUser

# Development  
curl -X POST http://localhost:5000/api/users/addUser
```

### **Storage Debug**
```bash
# Production
curl https://narap-backend.onrender.com/api/uploads/debug/files

# Development
curl http://localhost:5000/api/uploads/debug/files
```

## 🔄 **Deployment Checklist**

### **Before Deployment**
- [ ] All test scripts use production URL or environment variables
- [ ] Frontend files use production URL as default
- [ ] CORS configuration includes production domains
- [ ] Environment variables are set in deployment platform

### **After Deployment**
- [ ] Health check endpoint responds correctly
- [ ] File uploads work with Cloudinary integration
- [ ] Frontend can connect to backend
- [ ] All API endpoints are accessible

## 📝 **Notes**

1. **Environment Variables**: All test scripts now support `BACKEND_URL` environment variable for flexible testing
2. **Fallback URLs**: Production URL is used as fallback when environment variables are not set
3. **Dynamic Construction**: Backend routes construct URLs dynamically based on request context
4. **CORS Flexibility**: CORS allows both development and production origins
5. **LocalStorage Override**: Frontend supports custom backend URL via localStorage for testing

## 🎯 **Current Status**
✅ **All URLs are properly configured and consistent across the codebase**
✅ **Environment variable support implemented for flexibility**
✅ **Production deployment ready**
✅ **Development environment supported** 
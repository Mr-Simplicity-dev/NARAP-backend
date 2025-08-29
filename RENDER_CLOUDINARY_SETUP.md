# 🚀 Render + Cloudinary Setup Guide

## 🎯 **Current Status**
Your NARAP backend is already deployed on Render, but Cloudinary is not properly configured. This guide will help you set it up correctly.

## 🔑 **Step 1: Get Your Cloudinary Credentials**

### **1.1 Log into Cloudinary Dashboard**
- Go to [https://cloudinary.com/console](https://cloudinary.com/console)
- Sign in to your account

### **1.2 Find Your Account Details**
- Look for **"Account Details"** section
- Note down these values:
  - **Cloud Name** (e.g., `your-cloud-name`)
  - **API Key** (e.g., `123456789012345`)
  - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz`)

### **1.3 Verify Your Cloud Name**
- The cloud name is usually in lowercase
- Can contain letters, numbers, and hyphens
- **Cannot contain underscores**
- Examples: `narap-images`, `narapdb`, `narap-ng`

## 🌐 **Step 2: Configure Render Environment Variables**

### **2.1 Go to Your Render Dashboard**
- Navigate to [https://dashboard.render.com](https://dashboard.render.com)
- Find your NARAP backend service

### **2.2 Add Environment Variables**
- Click on your service
- Go to **"Environment"** tab
- Click **"Add Environment Variable"**
- Add these variables:

```bash
# Required for Cloudinary
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret
STORAGE_TYPE=cloudinary

# Optional but recommended
NODE_ENV=production
```

### **2.3 Example Environment Variables**
```bash
CLOUDINARY_CLOUD_NAME=narap-images
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
STORAGE_TYPE=cloudinary
NODE_ENV=production
```

## 🔄 **Step 3: Redeploy Your Service**

### **3.1 Trigger Manual Deploy**
- In your Render service dashboard
- Click **"Manual Deploy"**
- Select **"Deploy latest commit"**
- Wait for deployment to complete

### **3.2 Check Deployment Logs**
- Monitor the deployment logs
- Look for these success messages:
  ```
  ✅ Cloudinary initialized successfully
  ☁️ Cloud name: your-cloud-name
  🔧 Storage initialized: cloudinary (Cloud: true, Cloudinary: true)
  ```

## 🧪 **Step 4: Test the Configuration**

### **4.1 Test Cloudinary Connection**
```bash
# Test from your local machine
curl https://your-render-service.onrender.com/api/health
```

### **4.2 Test File Upload**
- Use the admin panel to upload a test photo
- Check if it's stored in Cloudinary
- Verify the photo URL starts with `https://res.cloudinary.com/`

## ❌ **Common Issues & Solutions**

### **Issue 1: "cloud_name mismatch" Error**
**Problem**: Wrong cloud name in environment variables
**Solution**: 
1. Double-check your cloud name in Cloudinary dashboard
2. Update `CLOUDINARY_CLOUD_NAME` in Render
3. Redeploy the service

### **Issue 2: "Invalid API key" Error**
**Problem**: Wrong API key or secret
**Solution**:
1. Copy the exact API key from Cloudinary dashboard
2. Copy the exact API secret from Cloudinary dashboard
3. Update both in Render environment variables
4. Redeploy the service

### **Issue 3: "Authentication failed" Error**
**Problem**: API credentials are incorrect
**Solution**:
1. Verify all three credentials are correct
2. Ensure no extra spaces or characters
3. Check if your Cloudinary account is active
4. Redeploy after fixing

### **Issue 4: Files not uploading to Cloudinary**
**Problem**: Fallback to local storage
**Solution**:
1. Check if `STORAGE_TYPE=cloudinary` is set
2. Verify all Cloudinary credentials are present
3. Check deployment logs for initialization messages
4. Redeploy if needed

## 🔍 **Debugging Steps**

### **1. Check Environment Variables**
```bash
# In your Render service logs, look for:
⚠️ Cloudinary credentials not found, using fallback storage
📋 Required environment variables:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
```

### **2. Check Cloudinary Initialization**
```bash
# Look for these messages in logs:
✅ Cloudinary initialized successfully
☁️ Cloud name: your-cloud-name
🔧 Storage initialized: cloudinary (Cloud: true, Cloudinary: true)
```

### **3. Test Cloudinary Configuration**
```bash
# Run this test script locally to verify credentials
node test-cloudinary-config.js
```

## 📋 **Environment Variables Checklist**

### **Required Variables**
- [ ] `CLOUDINARY_CLOUD_NAME` - Your actual cloud name
- [ ] `CLOUDINARY_API_KEY` - Your actual API key  
- [ ] `CLOUDINARY_API_SECRET` - Your actual API secret
- [ ] `STORAGE_TYPE=cloudinary` - Force Cloudinary usage

### **Optional Variables**
- [ ] `NODE_ENV=production` - Production environment
- [ ] `ALLOW_ALL_ORIGINS=true` - Allow all CORS origins (development)

## 🎯 **Expected Results After Setup**

### **Successful Setup**
1. ✅ Cloudinary initializes without errors
2. ✅ File uploads go directly to Cloudinary
3. ✅ Photo URLs start with `https://res.cloudinary.com/`
4. ✅ No more fallback to local storage
5. ✅ Files persist across server restarts

### **File Upload Flow**
1. User uploads photo through admin panel
2. Photo is sent to Cloudinary
3. Cloudinary returns secure URL
4. URL is stored in database
5. Photos are served directly from Cloudinary

## 🆘 **Getting Help**

### **If Still Having Issues**
1. **Check Render logs** for specific error messages
2. **Verify credentials** in Cloudinary dashboard
3. **Test locally** with `test-cloudinary-config.js`
4. **Check environment variables** in Render dashboard
5. **Redeploy** after making changes

### **Useful Commands**
```bash
# Test Cloudinary configuration
node test-cloudinary-config.js

# Test complete system
node test-cloud-deployment.js

# Check storage info
curl https://your-service.onrender.com/api/uploads/debug/files
```

## 🎉 **Success!**
Once configured correctly, your NARAP backend will:
- Store all photos in Cloudinary
- Serve photos from Cloudinary CDN
- Have persistent file storage
- Handle high traffic efficiently
- Scale automatically with Render

Your photos will be safe, fast, and accessible from anywhere!



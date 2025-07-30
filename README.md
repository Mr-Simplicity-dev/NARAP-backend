# NARAP Backend API Server

A robust Node.js/Express.js backend API server for the NARAP (National Association of Refrigeration and Air Conditioning Professionals) application.

## 🚀 Features

- **RESTful API** with Express.js
- **MongoDB** database with Mongoose ODM
- **JWT Authentication** for secure access
- **File Upload** support with Multer
- **CORS** enabled for cross-origin requests
- **Rate Limiting** for API protection
- **Security Headers** with Helmet
- **Compression** for better performance
- **Logging** with Morgan
- **Graceful Shutdown** handling
- **Health Check** endpoints
- **Database Cleanup** utilities

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account or local MongoDB instance
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit the .env file with your configuration
   nano .env
   ```

4. **Configure Environment Variables**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database Configuration
   MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/narap_db
   
   # Frontend URL (for CORS)
   FRONTEND_URL=http://localhost:3000
   
   # JWT Configuration
   JWT_SECRET=your_secure_jwt_secret_here
   JWT_EXPIRE=24h
   ```

## 🏃‍♂️ Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your .env file).

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Certificates
- `GET /api/certificates` - Get all certificates
- `POST /api/certificates` - Create new certificate
- `GET /api/certificates/:id` - Get certificate by ID
- `PUT /api/certificates/:id` - Update certificate
- `DELETE /api/certificates/:id` - Delete certificate
- `POST /api/certificates/:id/revoke` - Revoke certificate

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard analytics
- `GET /api/analytics/members` - Get member analytics
- `GET /api/analytics/certificates` - Get certificate analytics

### Uploads
- `GET /api/uploads/passports/:filename` - Get passport photo
- `GET /api/uploads/signatures/:filename` - Get signature file

### Health Check
- `GET /api/health` - Server health status

### Utilities
- `POST /api/cleanup-certificates` - Clean up database certificates

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGO_URI` | MongoDB connection string | Required |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `JWT_SECRET` | JWT secret key | Required |
| `JWT_EXPIRE` | JWT expiration time | `24h` |
| `MAX_FILE_SIZE` | Maximum file upload size | `10485760` (10MB) |

### Database Schema

#### User Model
```javascript
{
  name: String,
  email: String,
  code: String,
  position: String,
  state: String,
  zone: String,
  passportPhoto: String,
  signature: String
}
```

#### Certificate Model
```javascript
{
  number: String,
  certificateNumber: String,
  recipient: String,
  email: String,
  title: String,
  type: String,
  description: String,
  issueDate: Date,
  validUntil: Date,
  status: String,
  userId: ObjectId
}
```

## 🚀 Deployment

### Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add MONGO_URI
   vercel env add JWT_SECRET
   vercel env add FRONTEND_URL
   ```

### Railway Deployment

1. **Connect to Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Deploy**
   ```bash
   railway up
   ```

3. **Set Environment Variables** in Railway dashboard

### Render Deployment

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Set build command**: `npm install`
4. **Set start command**: `npm start`
5. **Add environment variables** in the dashboard

### Heroku Deployment

1. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**
   ```bash
   heroku config:set MONGO_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

## 🔒 Security Features

- **Helmet.js** for security headers
- **CORS** configuration
- **Rate limiting** to prevent abuse
- **JWT authentication**
- **Input validation**
- **File upload restrictions**

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Logs
The server uses Morgan for HTTP request logging. Logs are output to the console.

## 🛠️ Development

### Project Structure
```
backend/
├── models/          # Database models
├── routes/          # API routes
├── uploads/         # File uploads
├── middleware/      # Custom middleware
├── config/          # Configuration files
├── server.js        # Main server file
├── package.json     # Dependencies
└── README.md        # This file
```

### Adding New Routes

1. Create a new route file in `routes/`
2. Export the router
3. Import and use in `server.js`

Example:
```javascript
// routes/example.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Example route' });
});

module.exports = router;

// server.js
const exampleRoutes = require('./routes/example');
app.use('/api/example', exampleRoutes);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact the development team or create an issue in the repository. 
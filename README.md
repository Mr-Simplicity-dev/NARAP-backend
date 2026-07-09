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

### Contabo VPS Deployment (Docker — Recommended)

1. **SSH into your Contabo VPS**
   ```bash
   ssh user@your-contabo-ip
   ```

2. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in for group changes to take effect
   ```

3. **Clone the repository**
   ```bash
   git clone <your-repo-url> /path/to/app
   cd /path/to/app
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   nano .env   # Fill in your production values
   ```

5. **Build and start**
   ```bash
   docker compose up -d
   ```

6. **Update on code changes**
   ```bash
   git pull origin main
   docker compose up -d --build
   ```

7. **(Optional) Set up Nginx as reverse proxy** — same as PM2 section below.

### Contabo VPS Deployment (PM2 — Alternative)

1. **SSH into your Contabo VPS**
   ```bash
   ssh user@your-contabo-ip
   ```

2. **Install Node.js and npm**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

4. **Clone the repository and install dependencies**
   ```bash
   git clone <your-repo-url> /path/to/app
   cd /path/to/app
   npm install
   ```

5. **Set up environment variables**
   ```bash
   cp env.example .env
   nano .env   # Fill in your production values
   ```

6. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup   # Ensures app restarts on server reboot
   ```

7. **(Optional) Set up Nginx as reverse proxy**
   ```nginx
   # /etc/nginx/sites-available/narap
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. **Update deployment on code changes**
   ```bash
   git pull origin main
   npm install
   pm2 restart ecosystem.config.js
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
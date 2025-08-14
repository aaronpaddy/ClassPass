# ClassPass Setup Guide

This guide will help you set up ClassPass with your own API keys and configuration.

## 🔐 **Environment Setup**

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Configure Environment Variables**
Copy the example environment file and configure it:
```bash
cp env.example .env
```

Edit `.env` with your actual values:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Maps API Configuration
GOOGLE_MAPS_API_KEY=your_actual_google_maps_api_key_here

# Security Configuration
SESSION_SECRET=your_random_session_secret_here
PASSWORD_SALT=your_random_password_salt_here

# Face Recognition Configuration
FACE_RECOGNITION_THRESHOLD=0.8
MIN_FACES_PER_USER=3

# Location Validation Configuration
DEFAULT_ATTENDANCE_RADIUS=30
GPS_TIMEOUT=10000
```

### 3. **Google Maps API Setup**

#### **Get Your API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Maps JavaScript API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

#### **Configure the API Key:**
Replace `YOUR_API_KEY` in these files:
- `public/admin.html` (line with Google Maps script)
- Any other HTML files using Google Maps

**Example:**
```html
<!-- Before -->
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=geometry,places"></script>

<!-- After -->
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyC...&libraries=geometry,places"></script>
```

### 4. **Download AI Models**
```bash
node download-models.js
```

### 5. **Start the Application**
```bash
npm start
```

## 🚨 **Security Best Practices**

### **Never Commit These Files:**
- `.env` (contains your actual API keys)
- `database.sqlite` (contains user data)
- Any files with hardcoded API keys

### **Use Environment Variables:**
- Store sensitive data in `.env` file
- Reference them in code using `process.env.VARIABLE_NAME`
- Keep `.env.example` updated with required variables

### **API Key Restrictions:**
- Restrict Google Maps API key to your domain
- Set usage quotas to prevent abuse
- Monitor API usage regularly

## 🔧 **Configuration Options**

### **Face Recognition Settings:**
```env
FACE_RECOGNITION_THRESHOLD=0.8  # Lower = more strict
MIN_FACES_PER_USER=3             # Minimum faces for registration
```

### **Location Validation:**
```env
DEFAULT_ATTENDANCE_RADIUS=30     # Default radius in meters
GPS_TIMEOUT=10000                # GPS timeout in milliseconds
```

### **Security Settings:**
```env
SESSION_SECRET=random_string      # For session encryption
PASSWORD_SALT=random_string       # For password hashing
```

## 🐛 **Troubleshooting**

### **Google Maps Not Loading:**
- Check if API key is correct
- Verify Maps JavaScript API is enabled
- Check browser console for errors
- Ensure API key has proper restrictions

### **Environment Variables Not Working:**
- Make sure `.env` file exists in root directory
- Restart the server after changing `.env`
- Check variable names match exactly
- Verify `dotenv` is installed

### **Database Issues:**
- Check file permissions for `database.sqlite`
- Ensure SQLite3 is properly installed
- Restart server if database is locked

## 📱 **Production Deployment**

### **Environment Variables:**
- Use production-grade secrets
- Change default passwords and salts
- Set `NODE_ENV=production`
- Use HTTPS in production

### **API Key Security:**
- Restrict API keys to production domains
- Set appropriate usage quotas
- Monitor for unusual activity
- Rotate keys periodically

### **Database Security:**
- Use production-grade database
- Implement proper backup strategies
- Set appropriate file permissions
- Consider database encryption

## 🆘 **Need Help?**

- Check the main [README.md](README.md)
- Review inline code comments
- Check browser console for errors
- Verify all environment variables are set

---

**Remember**: Never commit your actual API keys or sensitive configuration to version control!

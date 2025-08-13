# Facial Recognition Attendance System

A modern, AI-powered facial recognition attendance system that automatically tracks attendance using face detection and recognition technology.

## Features

### 🎯 Core Features
- **Real-time Face Detection**: Detects faces in real-time using your device's camera
- **Facial Recognition**: Recognizes registered users with high accuracy
- **Automatic Attendance Tracking**: Records time in/out automatically
- **User Registration**: Register new users with multiple face angles
- **Attendance Records**: View and export attendance history
- **Modern UI**: Beautiful, responsive interface with real-time feedback

### 📊 Attendance Management
- **Time In/Out Tracking**: Automatically records entry and exit times
- **Daily Records**: Maintains daily attendance records
- **Export Functionality**: Export attendance data as CSV
- **Date Filtering**: Filter records by specific dates
- **Status Tracking**: Track attendance status (present, absent, etc.)

### 🔐 Security & Privacy
- **Local Processing**: Face recognition happens locally in the browser
- **Secure Storage**: User data stored securely in SQLite database
- **Privacy-First**: No external API calls for face processing
- **Data Control**: Full control over your attendance data

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Face Recognition**: face-api.js
- **Camera API**: WebRTC getUserMedia
- **UI Framework**: Custom CSS with modern design

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with camera access

### Step 1: Clone and Install Dependencies
```bash
# Install dependencies
npm install
```

### Step 2: Download Face Recognition Models
```bash
# Download required face-api.js models
node download-models.js
```

### Step 3: Start the Application
```bash
# Start the development server
npm start
```

### Step 4: Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### 1. Register New Users

1. **Click "Register New User"** in the header
2. **Fill in user details**:
   - Full Name
   - Email Address
   - Student/Employee ID
   - Department
3. **Start the camera** by clicking "Start Camera"
4. **Capture face images**:
   - Position the face in the camera view
   - Click "Capture Face" to take a photo
   - Capture at least 3 different angles for better recognition
5. **Submit registration** by clicking "Register User"

### 2. Take Attendance

1. **Click "Take Attendance"** in the header
2. **Start the camera** if not already active
3. **Click "Start Recognition"** to begin automatic attendance tracking
4. **Position faces** in the camera view for recognition
5. **View real-time status** of recognition and attendance marking
6. **Stop recognition** when finished

### 3. View Records

1. **Click "View Records"** in the header
2. **Filter by date** (optional) using the date picker
3. **View attendance records** in the table format
4. **Export data** as CSV by clicking "Export CSV"

## API Endpoints

### User Management
- `POST /api/register-user` - Register new user with facial data
- `GET /api/get-users` - Get all registered users
- `GET /api/user/:id` - Get specific user details
- `DELETE /api/user/:id` - Delete user

### Attendance Management
- `POST /api/mark-attendance` - Mark attendance (time in/out)
- `GET /api/get-attendance-records` - Get attendance records
- `GET /api/export-attendance-records` - Export records as CSV

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    user_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User Faces Table
```sql
CREATE TABLE user_faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    face_image TEXT NOT NULL,
    face_descriptor TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### Attendance Records Table
```sql
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date DATE NOT NULL,
    time_in DATETIME,
    time_out DATETIME,
    status TEXT DEFAULT 'present',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
```

### Face Recognition Settings
The system uses the following face recognition parameters:
- **Detection Model**: TinyFaceDetector (fast and lightweight)
- **Recognition Threshold**: 0.6 (lower = more strict)
- **Minimum Faces**: 3 per user (for better accuracy)

## Troubleshooting

### Camera Access Issues
- Ensure your browser supports WebRTC
- Check camera permissions in browser settings
- Try refreshing the page and granting camera access

### Face Recognition Issues
- Ensure good lighting conditions
- Position face clearly in camera view
- Capture multiple angles during registration
- Check if face-api.js models are downloaded correctly

### Performance Issues
- Close other applications using the camera
- Ensure stable internet connection for model loading
- Use a modern browser (Chrome, Firefox, Safari)

## Browser Compatibility

- **Chrome**: 60+ (Recommended)
- **Firefox**: 55+
- **Safari**: 11+
- **Edge**: 79+

## Security Considerations

- **Local Processing**: All face recognition happens locally
- **HTTPS**: Use HTTPS in production for secure camera access
- **Data Privacy**: User data is stored locally by default
- **Access Control**: Implement additional authentication if needed

## Development

### Project Structure
```
facial-recognition-attendance/
├── public/
│   ├── attendance.html          # Main application page
│   ├── attendance.js           # Frontend JavaScript
│   ├── attendance-styles.css   # Application styles
│   └── models/                 # Face recognition models
├── server.js                   # Express server
├── download-models.js          # Model download script
├── database.sqlite            # SQLite database
├── package.json               # Dependencies
└── README.md                 # This file
```

### Development Commands
```bash
# Start development server with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Ensure all dependencies are installed correctly

## Future Enhancements

- [ ] Multi-user simultaneous recognition
- [ ] Advanced analytics and reporting
- [ ] Mobile app version
- [ ] Integration with HR systems
- [ ] Advanced security features
- [ ] Cloud backup and sync
- [ ] Real-time notifications
- [ ] Advanced face liveness detection

---

**Note**: This system is designed for educational and small-scale use. For production environments, consider additional security measures and compliance requirements. 
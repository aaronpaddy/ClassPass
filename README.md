# ClassPass - AI-Powered Attendance Management System

A comprehensive, role-based attendance management system that combines facial recognition technology with class management, location verification, and real-time attendance tracking. Built for educational institutions where teachers can create classes and students can mark attendance using facial recognition within specified location boundaries.

## 🎯 **What is ClassPass?**

ClassPass is a modern attendance management system that:
- **Eliminates manual attendance taking** with AI-powered facial recognition
- **Ensures location-based attendance** using GPS and radius validation
- **Provides role-based access** for teachers and students
- **Offers real-time monitoring** and comprehensive reporting
- **Maintains data integrity** with secure authentication and validation

## ✨ **Key Features**

### 🔐 **Authentication & User Management**
- **Role-based Access Control**: Separate interfaces for teachers and students
- **Secure Registration & Login**: Password-protected accounts with role selection
- **Session Management**: Persistent login sessions with secure logout
- **User Profiles**: Complete user information management

### 👨‍🏫 **Teacher Dashboard**
- **Class Creation**: Create classes with unique codes, names, and descriptions
- **Location Setting**: Set class location using current GPS coordinates
- **Radius Configuration**: Customizable attendance radius (default: 30m)
- **Attendance Monitoring**: Real-time view of student attendance
- **Records Management**: Comprehensive attendance history and analytics

### 👨‍🎓 **Student Dashboard**
- **Class Enrollment**: Join classes using teacher-provided class codes
- **Face Recognition Setup**: Multi-angle facial registration for accurate recognition
- **Location Validation**: Automatic GPS verification within class radius
- **Attendance Marking**: One-click attendance with facial recognition
- **Personal Records**: View individual attendance history

### 🤖 **AI-Powered Recognition**
- **Real-time Detection**: Instant face detection using device camera
- **Multi-angle Registration**: Capture 3+ face angles for better accuracy
- **Confidence-based Recognition**: Smart recognition with configurable thresholds
- **Automatic Attendance**: Seamless attendance marking without manual input

### 📍 **Location Intelligence**
- **GPS Integration**: Real-time location tracking and validation
- **Radius Enforcement**: Ensures attendance only within specified boundaries
- **Distance Calculation**: Precise measurement between user and class location
- **Location Verification**: Visual confirmation of attendance validity

## 🏗️ **System Architecture**

### **Frontend Technologies**
- **HTML5/CSS3**: Modern, responsive interface with glassmorphism design
- **JavaScript (ES6+)**: Advanced frontend logic and API integration
- **WebRTC**: Camera access and real-time video streaming
- **face-api.js**: Client-side facial recognition processing

### **Backend Technologies**
- **Node.js**: High-performance JavaScript runtime
- **Express.js**: Fast, unopinionated web framework
- **SQLite3**: Lightweight, serverless database
- **Session Management**: Secure user authentication and state

### **AI & Recognition**
- **TinyFaceDetector**: Fast, lightweight face detection
- **Face Landmarks**: 68-point facial feature detection
- **Face Descriptors**: 128-dimensional biometric vectors
- **Euclidean Distance**: Advanced similarity matching algorithms

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js (v16 or higher)
- Modern web browser with camera access
- GPS-enabled device for location features

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd facial-recognition-attendance

# Install dependencies
npm install

# Download AI models
node download-models.js

# Start the application
npm start
```

### **Access the System**
Open your browser and navigate to:
```
http://localhost:3000
```

## 📱 **User Experience Flow**

### **For Teachers**
1. **Landing Page** → Select "Teacher" role
2. **Registration/Login** → Create account or sign in
3. **Dashboard** → View classes and create new ones
4. **Class Creation** → Set name, code, location, and radius
5. **Monitor Attendance** → Real-time view of student attendance
6. **Generate Reports** → Export attendance data and analytics

### **For Students**
1. **Landing Page** → Select "Student" role
2. **Registration/Login** → Create account or sign in
3. **Face Setup** → Register facial recognition data
4. **Join Class** → Enter class code provided by teacher
5. **Mark Attendance** → Use facial recognition within class radius
6. **View Records** → Check personal attendance history

## 🔧 **API Endpoints**

### **Authentication**
- `POST /api/register` - User registration (teacher/student)
- `POST /api/login` - User authentication
- `POST /api/logout` - Session termination

### **Class Management**
- `POST /api/create-class` - Create new class (teachers only)
- `GET /api/get-classes` - Get teacher's classes
- `POST /api/enroll-student` - Enroll student in class

### **Attendance Management**
- `POST /api/mark-attendance` - Mark attendance with location validation
- `GET /api/get-attendance-records` - Get user's attendance records
- `GET /api/get-class-attendance-records` - Get class attendance (teachers)

### **User Management**
- `POST /api/update-user` - Update user profile and face data
- `GET /api/get-users` - Get registered users for recognition
- `GET /api/get-enrolled-classes` - Get student's enrolled classes

## 🗄️ **Database Schema**

### **Users Table**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
    user_id TEXT,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Classes Table**
```sql
CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    attendance_radius INTEGER DEFAULT 30,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    teacher_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users (id)
);
```

### **Class Enrollments Table**
```sql
CREATE TABLE class_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(class_id, user_id)
);
```

### **Attendance Records Table**
```sql
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    class_id INTEGER,
    date DATE NOT NULL,
    time_in DATETIME,
    time_out DATETIME,
    status TEXT DEFAULT 'present',
    latitude REAL,
    longitude REAL,
    location_verified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (class_id) REFERENCES classes (id)
);
```

### **User Faces Table**
```sql
CREATE TABLE user_faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    face_image TEXT NOT NULL,
    face_descriptor TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## ⚙️ **Configuration**

### **Face Recognition Settings**
- **Detection Model**: TinyFaceDetector (optimized for speed)
- **Recognition Threshold**: 0.8 (configurable confidence level)
- **Minimum Faces**: 3 per user (for optimal accuracy)
- **Processing Interval**: 1 second (real-time recognition)

### **Location Settings**
- **Default Radius**: 30 meters (configurable per class)
- **GPS Timeout**: 10 seconds (with fallback handling)
- **Distance Calculation**: Haversine formula for accuracy
- **Location Validation**: Real-time GPS verification

### **Security Settings**
- **Password Hashing**: Base64 encoding (production: use bcrypt)
- **Session Management**: Browser sessionStorage
- **Input Validation**: Server-side data sanitization
- **SQL Injection Protection**: Parameterized queries

## 🎨 **UI/UX Features**

### **Modern Design**
- **Glassmorphism**: Contemporary glass-like interface elements
- **Responsive Layout**: Works seamlessly on all device sizes
- **Dark Theme**: Professional, eye-friendly color scheme
- **Smooth Animations**: CSS transitions and micro-interactions

### **User Experience**
- **Floating Notifications**: Toast-style feedback system
- **Modal Dialogs**: Important confirmations and information
- **Status Indicators**: Real-time system status updates
- **Auto-scrolling**: Smooth navigation to relevant sections

### **Accessibility**
- **High Contrast**: Clear text and element visibility
- **Icon Integration**: FontAwesome icons for visual clarity
- **Responsive Feedback**: Immediate response to user actions
- **Error Handling**: Clear error messages and recovery options

## 🔒 **Security Features**

### **Data Protection**
- **Local Processing**: Face recognition happens in browser
- **Encrypted Storage**: Secure password and data storage
- **Session Security**: Protected user sessions
- **Input Validation**: Comprehensive data sanitization

### **Access Control**
- **Role-based Permissions**: Teacher vs. student access levels
- **Class Isolation**: Teachers only see their own classes
- **Enrollment Validation**: Students can only join valid classes
- **Location Verification**: Prevents attendance fraud

## 📊 **Reporting & Analytics**

### **Teacher Reports**
- **Class Attendance**: Daily, weekly, and monthly views
- **Student Performance**: Individual attendance tracking
- **Location Compliance**: Verification status reports
- **Export Options**: CSV data export for external analysis

### **Student Reports**
- **Personal History**: Complete attendance record
- **Class Summary**: Overview of enrolled classes
- **Performance Metrics**: Attendance percentage and trends
- **Location Validation**: GPS verification history

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Face Recognition Not Working**
- Ensure camera permissions are granted
- Check if AI models are downloaded correctly
- Verify good lighting conditions
- Restart the application if needed

#### **Location Validation Fails**
- Enable GPS on your device
- Check browser location permissions
- Ensure you're within class radius
- Refresh GPS location if needed

#### **Database Errors**
- Restart the server
- Check database file permissions
- Verify table structure integrity
- Clear browser cache and cookies

### **Performance Optimization**
- **Browser**: Use Chrome or Firefox for best performance
- **Camera**: Ensure stable camera connection
- **Network**: Stable internet for initial model loading
- **Device**: Modern device with good camera quality

## 🌐 **Browser Compatibility**

- **Chrome**: 80+ (Recommended)
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## 🔮 **Future Enhancements**

### **Planned Features**
- [ ] **Multi-language Support**: Internationalization
- [ ] **Advanced Analytics**: Machine learning insights
- [ ] **Mobile Applications**: Native iOS/Android apps
- [ ] **Cloud Integration**: Multi-device synchronization
- [ ] **Advanced Security**: Biometric authentication
- [ ] **Real-time Notifications**: Push notifications
- [ ] **Integration APIs**: LMS and HR system connections
- [ ] **Advanced Reporting**: Custom dashboard creation

### **Technical Improvements**
- [ ] **Performance**: WebAssembly optimization
- [ ] **Scalability**: Database optimization and caching
- [ ] **Security**: Advanced encryption and authentication
- [ ] **Monitoring**: Real-time system health tracking

## 🤝 **Contributing**

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Setup**
```bash
# Install development dependencies
npm install --dev

# Run tests (when implemented)
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

### **Getting Help**
- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Email**: Contact the development team directly

### **Community**
- **GitHub**: Star and watch the repository
- **Contributions**: Submit pull requests and improvements
- **Feedback**: Share your experience and suggestions
- **Testing**: Help test on different devices and browsers

## 🙏 **Acknowledgments**

- **face-api.js**: Advanced facial recognition library
- **Express.js**: Fast, minimalist web framework
- **SQLite**: Lightweight, serverless database
- **FontAwesome**: Beautiful icon library
- **Open Source Community**: Contributors and maintainers

---

**ClassPass** - Transforming attendance management with AI and location intelligence.

*Built with ❤️ for educational institutions worldwide.* 
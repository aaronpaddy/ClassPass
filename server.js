const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Create models directory if it doesn't exist
const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    db.serialize(() => {
        // Check if tables exist, create only if they don't
        console.log('🔍 Checking existing tables...');
        
        // Check if users table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
            if (err) {
                console.error('Error checking tables:', err);
                return;
            }
            
            if (row) {
                console.log('✅ Tables already exist, skipping initialization');
                return;
            }
            
            console.log('📝 Tables not found, creating fresh database...');
            
            // Create fresh users table
            db.run(`CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
                user_id TEXT,
                department TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating users table:', err);
                } else {
                    console.log('✅ Users table created successfully');
                }
            });
            
            // Create user faces table
            db.run(`CREATE TABLE user_faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                face_image TEXT NOT NULL,
                face_descriptor TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating user_faces table:', err);
                } else {
                    console.log('✅ User_faces table created successfully');
                }
            });
            
            // Create classes table
            db.run(`CREATE TABLE classes (
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
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating classes table:', err);
                } else {
                    console.log('✅ Classes table created successfully');
                }
            });
            
            // Create class enrollments table
            db.run(`CREATE TABLE class_enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES classes (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(class_id, user_id)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating class_enrollments table:', err);
                } else {
                    console.log('✅ Class_enrollments table created successfully');
                }
            });
            
            // Create attendance records table
            db.run(`CREATE TABLE attendance_records (
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
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creating attendance_records table:', err);
                } else {
                    console.log('✅ Attendance_records table created successfully');
                }
            });
            
            console.log('🎉 Database initialization complete!');
        });
    });
}



// API Routes

// Authentication endpoints
app.post('/api/register', (req, res) => {
    const { name, email, password, role, department, studentId } = req.body;
    
    console.log('Registration attempt:', { name, email, role, department, studentId });
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (role === 'teacher' && !department) {
        return res.status(400).json({ error: 'Department is required for teachers' });
    }
    
    if (role === 'student' && !studentId) {
        return res.status(400).json({ error: 'Student ID is required for students' });
    }
    
    // Hash password (in production, use bcrypt)
    const salt = process.env.PASSWORD_SALT || 'default-salt-change-in-production';
    const hashedPassword = Buffer.from(password + salt).toString('base64');
    
    const userData = [name, email, hashedPassword, role];
    let query = 'INSERT INTO users (name, email, password, role';
    let placeholders = 'VALUES (?, ?, ?, ?';
    
    if (role === 'teacher') {
        query += ', department';
        placeholders += ', ?';
        userData.push(department);
    } else {
        query += ', user_id';
        placeholders += ', ?';
        userData.push(studentId);
    }
    
    query += ') ' + placeholders + ')';
    
    console.log('SQL Query:', query);
    console.log('User Data:', userData);
    
    db.run(query, userData, function(err) {
        if (err) {
            console.error('Database error details:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            if (err.message.includes('CHECK constraint failed')) {
                return res.status(400).json({ error: 'Invalid role specified' });
            }
            return res.status(500).json({ 
                error: 'Database error', 
                details: err.message,
                code: err.code 
            });
        }
        
        console.log('User created successfully with ID:', this.lastID);
        res.json({
            message: 'User registered successfully',
            userId: this.lastID
        });
    });
});

// Update user profile and add face recognition data
app.post('/api/update-user', (req, res) => {
    const { userId, name, email, id, department, faces } = req.body;
    
    if (!userId || !name || !email || !faces || faces.length === 0) {
        return res.status(400).json({ error: 'User ID, name, email, and faces are required' });
    }
    
    // Update user profile
        db.run('UPDATE users SET name = ?, user_id = ?, department = ? WHERE id = ?', 
            [name, id, department, userId], function(err) {
            if (err) {
                console.error('Error updating user:', err);
                return res.status(500).json({ error: 'Error updating user profile' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Add face recognition data
            const facePromises = faces.map(face => {
                return new Promise((resolve, reject) => {
                    db.run('INSERT INTO user_faces (user_id, face_image, face_descriptor) VALUES (?, ?, ?)', 
                        [userId, face.image, JSON.stringify(face.descriptor)], function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.lastID);
                        }
                    });
                });
            });
            
            Promise.all(facePromises)
                .then(() => {
                    res.json({ 
                        success: true, 
                        message: 'User profile and face recognition updated successfully',
                        userId: userId
                    });
                })
                .catch(err => {
                    console.error('Error adding face data:', err);
                    res.status(500).json({ error: 'Error adding face recognition data' });
                });
        });
    });


app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;
    
    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Hash password for comparison
    const salt = process.env.PASSWORD_SALT || 'default-salt-change-in-production';
    const hashedPassword = Buffer.from(password + salt).toString('base64');
    
    db.get('SELECT * FROM users WHERE email = ? AND password = ? AND role = ?', 
        [email, hashedPassword, role], (err, row) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials or role' });
        }
        
        // Don't send password in response
        const { password: _, ...user } = row;
        
        res.json({
            message: 'Login successful',
            user
        });
    });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    // In a real app, you would invalidate JWT tokens here
    // For now, just return success since we're using sessionStorage
    res.json({ success: true, message: 'Logged out successfully' });
});

// Get enrolled classes for a student
app.get('/api/get-enrolled-classes', (req, res) => {
    const { studentId } = req.query;
    
    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }
    
    try {
        // Get all classes the student is enrolled in
        db.all(`
            SELECT c.*, u.name as teacher_name 
            FROM classes c 
            JOIN users u ON c.teacher_id = u.id 
            JOIN class_enrollments ce ON c.id = ce.class_id 
            WHERE ce.user_id = ?
            ORDER BY c.name
        `, [studentId], (err, rows) => {
            if (err) {
                console.error('Error fetching enrolled classes:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(rows || []);
        });
    } catch (error) {
        console.error('Get enrolled classes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Enroll student in a class using class code
app.post('/api/enroll-student', (req, res) => {
    const { classCode, studentId } = req.body;
    
    if (!classCode || !studentId) {
        return res.status(400).json({ error: 'Class code and student ID are required' });
    }
    
    // First, find the class by code
    db.get('SELECT c.*, u.name as teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id WHERE c.code = ?', 
        [classCode.toUpperCase()], (err, classRow) => {
        if (err) {
            console.error('Error finding class:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!classRow) {
            return res.status(404).json({ error: 'Class not found with this code' });
        }
        
        // Check if student is already enrolled
        db.get('SELECT * FROM class_enrollments WHERE class_id = ? AND user_id = ?', 
            [classRow.id, studentId], (err, enrollmentRow) => {
            if (err) {
                console.error('Error checking enrollment:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (enrollmentRow) {
                return res.status(400).json({ error: 'Student is already enrolled in this class' });
            }
            
            // Enroll the student
            db.run('INSERT INTO class_enrollments (class_id, user_id) VALUES (?, ?)', 
                [classRow.id, studentId], function(err) {
                if (err) {
                    console.error('Error enrolling student:', err);
                    return res.status(500).json({ error: 'Error enrolling student' });
                }
                
                res.json({
                    success: true,
                    message: 'Student enrolled successfully',
                    class: {
                        id: classRow.id,
                        name: classRow.name,
                        code: classRow.code,
                        description: classRow.description,
                        attendance_radius: classRow.attendance_radius,
                        latitude: classRow.latitude,
                        longitude: classRow.longitude,
                        teacher_name: classRow.teacher_name
                    }
                });
            });
        });
    });
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Register new user with facial data
app.post('/api/register-user', async (req, res) => {
    try {
        const { name, email, id, department, faces } = req.body;

        if (!name || !email || !id || !department || !faces || faces.length < 3) {
            return res.status(400).json({ error: 'All fields are required and at least 3 face images needed' });
        }

        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ? OR user_id = ?', [email, id], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(400).json({ error: 'User with this email or ID already exists' });
            }

            // Insert user
            db.run('INSERT INTO users (name, email, user_id, department) VALUES (?, ?, ?, ?)', 
                [name, email, id, department], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error creating user' });
                }

                const userId = this.lastID;

                // Insert face data
                let faceInsertCount = 0;
                faces.forEach((face, index) => {
                    // Handle faces with or without descriptors
                    const descriptor = face.descriptor ? JSON.stringify(face.descriptor) : null;
                    
                    db.run('INSERT INTO user_faces (user_id, face_image, face_descriptor) VALUES (?, ?, ?)',
                        [userId, face.image, descriptor], function(err) {
                        if (err) {
                            console.error('Error inserting face:', err);
                        } else {
                            faceInsertCount++;
                            if (faceInsertCount === faces.length) {
                                res.json({ 
                                    success: true, 
                                    message: 'User registered successfully',
                                    userId: userId 
                                });
                            }
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all registered users
app.get('/api/get-users', (req, res) => {
    // Get users with their face descriptors individually
    const query = `
        SELECT u.id, u.name, u.email, u.user_id, u.department, uf.face_descriptor
        FROM users u
        LEFT JOIN user_faces uf ON u.id = uf.user_id
        WHERE uf.face_descriptor IS NOT NULL
        ORDER BY u.id, uf.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Group faces by user
        const userMap = new Map();
        
        rows.forEach(row => {
            if (!userMap.has(row.id)) {
                userMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    userId: row.user_id,
                    department: row.department,
                    faces: []
                });
            }
            
            try {
                const descriptor = JSON.parse(row.face_descriptor);
                userMap.get(row.id).faces.push({ descriptor });
            } catch (e) {
                console.log('Invalid descriptor for user', row.name, ':', e.message);
            }
        });

        const users = Array.from(userMap.values());
        console.log(`Loaded ${users.length} users with ${users.reduce((sum, u) => sum + u.faces.length, 0)} total faces`);
        res.json(users);
    });
});

// Mark attendance using class code and GPS validation
app.post('/api/mark-attendance', (req, res) => {
    try {
        const { userId, timestamp, latitude, longitude, classCode } = req.body;
        const date = new Date(timestamp).toISOString().split('T')[0];
        const time = new Date(timestamp).toISOString();

        if (!userId || !timestamp || !latitude || !longitude || !classCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // First, find the class by code and check if student is enrolled
        db.get(`
            SELECT c.*, u.name as teacher_name 
            FROM classes c 
            JOIN users u ON c.teacher_id = u.id 
            JOIN class_enrollments ce ON c.id = ce.class_id 
            WHERE c.code = ? AND ce.user_id = ?
        `, [classCode.toUpperCase(), userId], (err, classRow) => {
            if (err) {
                console.error('Error finding class:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!classRow) {
                return res.status(404).json({ error: 'Class not found or you are not enrolled' });
            }

            // Calculate distance between user location and class location
            const distance = calculateDistance(
                latitude, longitude,
                classRow.latitude, classRow.longitude
            );

            const locationVerified = distance <= classRow.attendance_radius;

            if (!locationVerified) {
                return res.status(400).json({ 
                    error: 'Location verification failed', 
                    message: `You must be within ${classRow.attendance_radius} meters of ${classRow.name} to mark attendance. Current distance: ${Math.round(distance)} meters.`,
                    distance: Math.round(distance),
                    radius: classRow.attendance_radius,
                    classLocation: {
                        lat: classRow.latitude,
                        lng: classRow.longitude
                    }
                });
            }

            // Check if attendance record exists for today
            db.get('SELECT * FROM attendance_records WHERE user_id = ? AND class_id = ? AND date = ?', 
                [userId, classRow.id, date], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (row) {
                    // Update existing record (time out)
                    if (!row.time_out) {
                        db.run('UPDATE attendance_records SET time_out = ?, latitude = ?, longitude = ?, location_verified = ? WHERE id = ?', 
                            [time, latitude, longitude, locationVerified, row.id], function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Error updating attendance' });
                            }
                            res.json({ 
                                status: 'Time out recorded', 
                                recordId: row.id,
                                locationVerified: locationVerified,
                                distance: Math.round(distance),
                                class: classRow.name
                            });
                        });
                    } else {
                        res.json({ status: 'Already marked time out for today' });
                    }
                } else {
                    // Create new record (time in)
                    db.run('INSERT INTO attendance_records (user_id, class_id, date, time_in, latitude, longitude, location_verified) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                        [userId, classRow.id, date, time, latitude, longitude, locationVerified], function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error creating attendance record' });
                        }
                        res.json({ 
                            status: 'Time in recorded', 
                            recordId: this.lastID,
                            locationVerified: locationVerified,
                            distance: Math.round(distance),
                            class: classRow.name
                        });
                    });
                }
            });
        });
    } catch (error) {
        console.error('Attendance marking error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get attendance records
app.get('/api/get-attendance-records', (req, res) => {
    const { date, userId } = req.query;
    let query = `
        SELECT ar.*, u.name, u.user_id, u.department, c.name as class_name
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        LEFT JOIN classes c ON ar.class_id = c.id
    `;
    let params = [];
    let whereConditions = [];

    if (userId) {
        whereConditions.push('ar.user_id = ?');
        params.push(userId);
    }

    if (date) {
        whereConditions.push('ar.date = ?');
        params.push(date);
    }

    if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY ar.date DESC, ar.time_in DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const records = rows.map(row => {
            // Parse date safely
            let parsedDate = 'Invalid Date';
            try {
                if (row.date) {
                    const dateObj = new Date(row.date);
                    if (!isNaN(dateObj.getTime())) {
                        parsedDate = dateObj.toLocaleDateString();
                    }
                }
            } catch (e) {
                console.log('Date parsing error:', e);
            }

            // Parse time safely
            let parsedTimeIn = 'N/A';
            let parsedTimeOut = 'N/A';
            try {
                if (row.time_in) {
                    const timeInObj = new Date(row.time_in);
                    if (!isNaN(timeInObj.getTime())) {
                        parsedTimeIn = timeInObj.toLocaleTimeString();
                    }
                }
                if (row.time_out) {
                    const timeOutObj = new Date(row.time_out);
                    if (!isNaN(timeOutObj.getTime())) {
                        parsedTimeOut = timeOutObj.toLocaleTimeString();
                    }
                }
            } catch (e) {
                console.log('Time parsing error:', e);
            }

            return {
                id: row.id,
                name: row.name || 'Unknown Student',
                userId: row.user_id || 'N/A',
                department: row.department || 'N/A',
                date: parsedDate,
                timeIn: parsedTimeIn,
                timeOut: parsedTimeOut,
                status: row.status || 'Present',
                locationVerified: row.location_verified || false,
                className: row.class_name || 'Unknown Class'
            };
        });

        res.json(records);
    });
});

// Location-based attendance validation
app.post('/api/validate-location', (req, res) => {
    try {
        const { latitude, longitude, classLocationId } = req.body;
        
        if (!latitude || !longitude || !classLocationId) {
            return res.status(400).json({ error: 'Latitude, longitude, and class location ID are required' });
        }

        // Get class location details
        db.get('SELECT * FROM class_locations WHERE id = ?', [classLocationId], (err, location) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!location) {
                return res.status(404).json({ error: 'Class location not found' });
            }

            // Calculate distance between user location and class location using Haversine formula
            const distance = calculateDistance(
                latitude, longitude,
                location.latitude, location.longitude
            );

            const isWithinRadius = distance <= location.radius_meters;
            
            res.json({
                success: true,
                isWithinRadius,
                distance: Math.round(distance),
                radius: location.radius_meters,
                classLocation: location
            });
        });
    } catch (error) {
        console.error('Location validation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all class locations
app.get('/api/class-locations', (req, res) => {
    db.all('SELECT * FROM class_locations ORDER BY class_name', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Add new class location
app.post('/api/class-locations', (req, res) => {
    try {
        const { className, building, room, latitude, longitude, radiusMeters, department } = req.body;
        
        if (!className || !building || !room || !latitude || !longitude || !department) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const radius = radiusMeters || 50; // Default 50 meters

        db.run('INSERT INTO class_locations (class_name, building, room, latitude, longitude, radius_meters, department) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [className, building, room, latitude, longitude, radius, department], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error creating class location' });
            }
            res.json({ 
                success: true, 
                message: 'Class location created successfully',
                id: this.lastID 
            });
        });
    } catch (error) {
        console.error('Class location creation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update class location
app.put('/api/class-locations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { className, building, room, latitude, longitude, radiusMeters, department } = req.body;
        
        if (!className || !building || !room || !latitude || !longitude || !department) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const radius = radiusMeters || 50;

        db.run('UPDATE class_locations SET class_name = ?, building = ?, room = ?, latitude = ?, longitude = ?, radius_meters = ?, department = ? WHERE id = ?',
            [className, building, room, latitude, longitude, radius, department, id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating class location' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Class location not found' });
            }
            res.json({ success: true, message: 'Class location updated successfully' });
        });
    } catch (error) {
        console.error('Class location update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete class location
app.delete('/api/class-locations/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM class_locations WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Class location not found' });
        }
        res.json({ success: true, message: 'Class location deleted successfully' });
    });
});

// Export attendance records as CSV
app.get('/api/export-attendance-records', (req, res) => {
    const query = `
        SELECT ar.*, u.name, u.user_id, u.department
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        ORDER BY ar.date DESC, ar.time_in DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        let csv = 'Name,ID,Department,Date,Time In,Time Out,Status\n';
        
        rows.forEach(row => {
            const name = `"${row.name}"`;
            const userId = `"${row.user_id}"`;
            const department = `"${row.department}"`;
            const date = `"${row.date}"`;
            const timeIn = row.time_in ? `"${new Date(row.time_in).toLocaleTimeString()}"` : '""';
            const timeOut = row.time_out ? `"${new Date(row.time_out).toLocaleTimeString()}"` : '""';
            const status = `"${row.status}"`;
            
            csv += `${name},${userId},${department},${date},${timeIn},${timeOut},${status}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance-records-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    });
});

// Get user by ID
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(row);
    });
});

// Delete user
app.delete('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted successfully' });
    });
});

// Serve the attendance page
app.get('/attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'attendance.html'));
});

// Default route - serve landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Student attendance route
app.get('/attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'attendance.html'));
});

// New API endpoints for the improved system

// Create a new class
app.post('/api/create-class', (req, res) => {
    const { name, code, description, attendanceRadius, latitude, longitude, teacherId } = req.body;
    
    if (!name || !code || !latitude || !longitude || !teacherId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.run('INSERT INTO classes (name, code, description, attendance_radius, latitude, longitude, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, code.toUpperCase(), description, attendanceRadius || 30, latitude, longitude, teacherId],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Class code already exists' });
                }
                console.error('Error creating class:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
                id: this.lastID,
                name,
                code: code.toUpperCase(),
                message: 'Class created successfully'
            });
        }
    );
});

// Get classes for a specific teacher
app.get('/api/get-classes', (req, res) => {
    const { teacherId } = req.query;
    
    if (!teacherId) {
        return res.status(400).json({ error: 'Teacher ID is required' });
    }
    
    const query = `
        SELECT c.*, COUNT(ce.user_id) as studentCount
        FROM classes c
        LEFT JOIN class_enrollments ce ON c.id = ce.class_id
        WHERE c.teacher_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
    `;
    
    db.all(query, [teacherId], (err, rows) => {
        if (err) {
            console.error('Error getting classes:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(rows);
    });
});

// Get attendance records for a specific class (teacher view)
app.get('/api/get-class-attendance-records', (req, res) => {
    const { classId, date } = req.query;
    
    if (!classId) {
        return res.status(400).json({ error: 'Class ID is required' });
    }
    
    let query = `
        SELECT ar.*, u.name as studentName, u.user_id as studentId, c.name as className
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        JOIN classes c ON ar.class_id = c.id
        WHERE c.id = ?
    `;
    
    const params = [classId];
    
    if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        query += ' AND DATE(ar.date) = ?';
        params.push(dateStr);
    }
    
    query += ' ORDER BY ar.created_at DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error getting attendance records:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Format the records properly for teacher view
        const formattedRecords = rows.map(row => {
            // Parse date safely
            let parsedDate = 'Invalid Date';
            try {
                if (row.date) {
                    const dateObj = new Date(row.date);
                    if (!isNaN(dateObj.getTime())) {
                        parsedDate = dateObj.toLocaleDateString();
                    }
                }
            } catch (e) {
                console.log('Date parsing error:', e);
            }

            // Parse time safely
            let parsedTimeIn = 'N/A';
            let parsedTimeOut = 'N/A';
            try {
                if (row.time_in) {
                    const timeInObj = new Date(row.time_in);
                    if (!isNaN(timeInObj.getTime())) {
                        parsedTimeIn = timeInObj.toLocaleTimeString();
                    }
                }
                if (row.time_out) {
                    const timeOutObj = new Date(row.time_out);
                    if (!isNaN(timeOutObj.getTime())) {
                        parsedTimeOut = timeOutObj.toLocaleTimeString();
                    }
                }
            } catch (e) {
                console.log('Time parsing error:', e);
            }

            return {
                id: row.id,
                studentName: row.studentName || 'Unknown Student',
                studentId: row.studentId || 'N/A',
                className: row.className || 'Unknown Class',
                date: parsedDate,
                timeIn: parsedTimeIn,
                timeOut: parsedTimeOut,
                status: row.status || 'Present',
                locationVerified: row.location_verified || false,
                latitude: row.latitude,
                longitude: row.longitude
            };
        });
        
        res.json(formattedRecords);
    });
});

// Enroll a student in a class
app.post('/api/enroll-student', (req, res) => {
    const { classCode, userId } = req.body;
    
    if (!classCode || !userId) {
        return res.status(400).json({ error: 'Class code and user ID are required' });
    }
    
    // First get the class
    db.get('SELECT * FROM classes WHERE code = ?', [classCode.toUpperCase()], (err, classRow) => {
        if (err) {
            console.error('Error getting class:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!classRow) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        // Check if already enrolled
        db.get('SELECT * FROM class_enrollments WHERE class_id = ? AND user_id = ?', 
            [classRow.id, userId], (err, enrollmentRow) => {
            if (err) {
                console.error('Error checking enrollment:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (enrollmentRow) {
                return res.status(400).json({ error: 'Student already enrolled in this class' });
            }
            
            // Enroll the student
            db.run('INSERT INTO class_enrollments (class_id, user_id) VALUES (?, ?)',
                [classRow.id, userId], function(err) {
                if (err) {
                    console.error('Error enrolling student:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                res.json({
                    message: 'Student enrolled successfully',
                    classId: classRow.id,
                    className: classRow.name
                });
            });
        });
    });
});

// Test database connection
app.get('/api/test-db', (req, res) => {
    db.get('SELECT 1 as test', (err, row) => {
        if (err) {
            console.error('Database test failed:', err);
            return res.status(500).json({ error: 'Database connection failed', details: err.message });
        }
        res.json({ message: 'Database connection successful', test: row.test });
    });
});

// Check users table structure
app.get('/api/check-users-table', (req, res) => {
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('Error checking users table:', err);
            return res.status(500).json({ error: 'Failed to check table structure', details: err.message });
        }
        res.json({ 
            message: 'Users table structure', 
            columns: rows,
            tableExists: rows.length > 0
        });
    });
});

// Database reset route (for development only)
app.post('/api/reset-database', (req, res) => {
    console.log('Resetting database...');
    
    db.serialize(() => {
        // Drop all tables
        db.run('DROP TABLE IF EXISTS user_faces', (err) => {
            if (err) console.error('Error dropping user_faces:', err);
        });
        
        db.run('DROP TABLE IF EXISTS class_enrollments', (err) => {
            if (err) console.error('Error dropping class_enrollments:', err);
        });
        
        db.run('DROP TABLE IF EXISTS classes', (err) => {
            if (err) console.error('Error dropping classes:', err);
        });
        
        db.run('DROP TABLE IF EXISTS attendance_records', (err) => {
            if (err) console.error('Error dropping attendance_records:', err);
        });
        
        db.run('DROP TABLE IF EXISTS class_locations', (err) => {
            if (err) console.error('Error dropping class_locations:', err);
        });
        
        db.run('DROP TABLE IF EXISTS users', (err) => {
            if (err) console.error('Error dropping users:', err);
        });
        
        // Reinitialize database
        setTimeout(() => {
            initializeDatabase();
            res.json({ message: 'Database reset successfully' });
        }, 1000);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Facial Recognition Attendance System running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
}); 
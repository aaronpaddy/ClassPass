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
    db.serialize(() => {
        // Users table for facial recognition
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            user_id TEXT UNIQUE NOT NULL,
            department TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // User faces table
        db.run(`CREATE TABLE IF NOT EXISTS user_faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            face_image TEXT NOT NULL,
            face_descriptor TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Class locations table for attendance validation
        db.run(`CREATE TABLE IF NOT EXISTS class_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT NOT NULL,
            building TEXT NOT NULL,
            room TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_meters INTEGER DEFAULT 50,
            department TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Attendance records table with location validation
        db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            class_location_id INTEGER,
            date DATE NOT NULL,
            time_in DATETIME,
            time_out DATETIME,
            status TEXT DEFAULT 'present',
            latitude REAL,
            longitude REAL,
            location_verified BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (class_location_id) REFERENCES class_locations (id)
        )`);

        // Insert default class locations if none exist
        db.get('SELECT COUNT(*) as count FROM class_locations', (err, row) => {
            if (err) {
                console.error('Error checking class locations:', err);
            } else if (row.count === 0) {
                // Insert some default class locations
                const defaultLocations = [
                    ['Computer Science Lab', 'Engineering Building', 'Room 101', 40.7128, -74.0060, 50, 'Computer Science'],
                    ['Mathematics Classroom', 'Science Building', 'Room 205', 40.7128, -74.0060, 50, 'Mathematics'],
                    ['Physics Lab', 'Science Building', 'Room 301', 40.7128, -74.0060, 50, 'Physics']
                ];
                
                defaultLocations.forEach(location => {
                    db.run('INSERT INTO class_locations (class_name, building, room, latitude, longitude, radius_meters, department) VALUES (?, ?, ?, ?, ?, ?, ?)', location);
                });
                console.log('Default class locations inserted');
            }
        });
    });
}

// API Routes

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

// Mark attendance
app.post('/api/mark-attendance', (req, res) => {
    try {
        const { userId, timestamp, latitude, longitude, classLocationId } = req.body;
        const date = new Date(timestamp).toISOString().split('T')[0];
        const time = new Date(timestamp).toISOString();

        // Validate location if provided
        let locationVerified = false;
        if (latitude && longitude && classLocationId) {
            // Get class location details
            db.get('SELECT * FROM class_locations WHERE id = ?', [classLocationId], (err, location) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!location) {
                    return res.status(404).json({ error: 'Class location not found' });
                }

                // Calculate distance between user location and class location
                const distance = calculateDistance(
                    latitude, longitude,
                    location.latitude, location.longitude
                );

                locationVerified = distance <= location.radius_meters;

                if (!locationVerified) {
                    return res.status(400).json({ 
                        error: 'Location verification failed', 
                        message: `You must be within ${location.radius_meters} meters of ${location.class_name} to mark attendance. Current distance: ${Math.round(distance)} meters.`,
                        distance: Math.round(distance),
                        radius: location.radius_meters
                    });
                }

                // Continue with attendance marking
                processAttendance();
            });
        } else {
            // No location data provided, continue without validation
            processAttendance();
        }

        function processAttendance() {
            // Check if attendance record exists for today
            db.get('SELECT * FROM attendance_records WHERE user_id = ? AND date = ?', 
                [userId, date], (err, row) => {
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
                                locationVerified: locationVerified
                            });
                        });
                    } else {
                        res.json({ status: 'Already marked time out for today' });
                    }
                } else {
                    // Create new record (time in)
                    db.run('INSERT INTO attendance_records (user_id, class_location_id, date, time_in, latitude, longitude, location_verified) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                        [userId, classLocationId, date, time, latitude, longitude, locationVerified], function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error creating attendance record' });
                        }
                        res.json({ 
                            status: 'Time in recorded', 
                            recordId: this.lastID,
                            locationVerified: locationVerified
                        });
                    });
                }
            });
        }
    } catch (error) {
        console.error('Attendance marking error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get attendance records
app.get('/api/get-attendance-records', (req, res) => {
    const { date } = req.query;
    let query = `
        SELECT ar.*, u.name, u.user_id, u.department, cl.class_name, cl.building, cl.room
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        LEFT JOIN class_locations cl ON ar.class_location_id = cl.id
    `;
    let params = [];

    if (date) {
        query += ' WHERE ar.date = ?';
        params.push(date);
    }

    query += ' ORDER BY ar.date DESC, ar.time_in DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const records = rows.map(row => ({
            id: row.id,
            name: row.name,
            userId: row.user_id,
            department: row.department,
            date: row.date,
            timeIn: row.time_in ? new Date(row.time_in).toLocaleTimeString() : null,
            timeOut: row.time_out ? new Date(row.time_out).toLocaleTimeString() : null,
            status: row.status,
            locationVerified: row.location_verified,
            classLocation: row.class_name ? {
                class_name: row.class_name,
                building: row.building,
                room: row.room
            } : null
        }));

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

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'attendance.html'));
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
class FacialRecognitionAttendance {
    constructor() {
        console.log('Initializing FacialRecognitionAttendance...');
        
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.faceBox = document.getElementById('faceBox');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        // Check if required elements exist
        if (!this.video) console.error('Video element not found');
        if (!this.canvas) console.error('Canvas element not found');
        if (!this.faceBox) console.error('FaceBox element not found');
        if (!this.statusIndicator) console.error('StatusIndicator element not found');
        
        this.isCameraActive = false;
        this.isRecognitionActive = false;
        this.faceDetectionInterval = null;
        this.recognitionInterval = null;
        this.capturedFaces = [];
        this.registeredUsers = [];
        this.currentUser = null;
        this.modelsLoaded = false;
        this.fullRecognitionAvailable = false;
        this.lastAttendanceMark = {}; // Track last attendance mark per user
        this.attendanceCooldown = 30000; // 30 seconds cooldown
        
        // Location-related properties
        this.currentLocation = null;
        this.selectedClassLocation = null;
        this.classLocations = [];
        this.gpsWatchId = null;
        
        console.log('Initializing event listeners...');
        this.initializeEventListeners();
        this.updateCurrentTime();
        
        // Wait a bit for face-api.js to load
        setTimeout(() => {
            console.log('Loading face API...');
            this.updateStatus('Loading face recognition models...');
            this.loadFaceAPI();
        }, 1000);
        
        // Also listen for fallback loading
        window.addEventListener('faceapiLoaded', () => {
            console.log('Face API loaded via fallback, loading models...');
            this.updateStatus('Loading face recognition models...');
            this.loadFaceAPI();
        });
        
        // Don't load class locations here - they'll be loaded when attendance section is shown
        // this.loadClassLocations();
        
        console.log('FacialRecognitionAttendance initialized');
    }

        async loadFaceAPI() {
        try {
            this.updateStatus('Loading face recognition models...');
            console.log('Starting to load face-api.js models...');
            
            // Wait for face-api.js to be available
            let attempts = 0;
            const maxAttempts = 30; // Wait up to 30 seconds
            
            while (typeof faceapi === 'undefined' && attempts < maxAttempts) {
                console.log(`Waiting for face-api.js to load... (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            // Check if faceapi is available
            if (typeof faceapi === 'undefined') {
                throw new Error('face-api.js library not loaded after 30 seconds');
            }
            
            console.log('face-api.js library loaded, loading models...');
            
            // Add timeout to prevent hanging
            const modelLoadTimeout = 30000; // 30 seconds timeout
            
            // Load models progressively with better error handling
            console.log('Loading TinyFaceDetector...');
            this.updateModelStatus('Loading TinyFaceDetector...');
            await Promise.race([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TinyFaceDetector timeout')), modelLoadTimeout))
            ]);
            console.log('✓ TinyFaceDetector loaded');
            
            // Try to load FaceLandmark68Net (smaller model)
            console.log('Loading FaceLandmark68Net...');
            this.updateModelStatus('Loading FaceLandmark68Net...');
            try {
                await Promise.race([
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('FaceLandmark68Net timeout')), modelLoadTimeout))
                ]);
                console.log('✓ FaceLandmark68Net loaded');
                
                // Try to load FaceRecognitionNet (largest model)
                console.log('Loading FaceRecognitionNet...');
                this.updateModelStatus('Loading FaceRecognitionNet...');
                try {
                    await Promise.race([
                        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('FaceRecognitionNet timeout')), modelLoadTimeout))
                    ]);
                    console.log('✓ FaceRecognitionNet loaded');
                    
                    // Try to load FaceExpressionNet
                    console.log('Loading FaceExpressionNet...');
                    this.updateModelStatus('Loading FaceExpressionNet...');
                    await Promise.race([
                        faceapi.nets.faceExpressionNet.loadFromUri('/models'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('FaceExpressionNet timeout')), modelLoadTimeout))
                    ]);
                    console.log('✓ FaceExpressionNet loaded');
                    
                } catch (recognitionError) {
                    console.error('❌ FaceRecognitionNet failed to load:', recognitionError);
                    console.log('⚠️ Falling back to landmark-only recognition');
                    // Continue with landmark detection only
                }
                
            } catch (landmarkError) {
                console.error('❌ FaceLandmark68Net failed to load:', landmarkError);
                console.log('⚠️ Falling back to basic detection only');
                throw landmarkError;
            }
            
            // Check which models loaded successfully
            const hasLandmarks = faceapi.nets.faceLandmark68Net.isLoaded;
            const hasRecognition = faceapi.nets.faceRecognitionNet.isLoaded;
            
            console.log('Model loading complete');
            console.log('Landmarks available:', hasLandmarks);
            console.log('Recognition available:', hasRecognition);
            
            this.modelsLoaded = true;
            
            if (hasRecognition && hasLandmarks) {
                this.fullRecognitionAvailable = true;
                this.updateStatus('All face recognition models loaded successfully');
                this.updateModelStatus('✅ Full Face ID-style recognition available');
                this.updateRecognitionMode('Advanced: Automatic Face Recognition');
                this.showNotification('Advanced face recognition loaded successfully', 'success');
            } else if (hasLandmarks) {
                this.fullRecognitionAvailable = false;
                this.updateStatus('Partial recognition models loaded');
                this.updateModelStatus('✅ Landmark detection available (manual selection)');
                this.updateRecognitionMode('Intermediate: Landmark Detection');
                this.showNotification('Landmark detection loaded (manual selection required)', 'info');
            } else {
                this.fullRecognitionAvailable = false;
                this.updateStatus('Basic face detection available');
                this.updateModelStatus('✅ Basic face detection loaded (manual selection required)');
                this.updateRecognitionMode('Basic: Manual Selection Required');
                this.showNotification('Basic face detection loaded (manual selection required)', 'info');
            }
            
            // Enable capture button now that models are loaded
            const captureBtn = document.getElementById('captureBtn');
            if (captureBtn) {
                captureBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error loading face-api.js models:', error);
            this.updateStatus('Error loading models: ' + error.message);
            this.showNotification('Error loading face recognition models: ' + error.message, 'error');
            
            // Try to load at least the basic detection model
            try {
                console.log('Attempting to load basic face detection only...');
                if (typeof faceapi !== 'undefined') {
                    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                    this.modelsLoaded = true;
                    this.fullRecognitionAvailable = false; // Only basic detection
                    this.updateStatus('Basic face detection available');
                    this.updateModelStatus('✅ Basic face detection loaded (recognition disabled)');
                    this.updateRecognitionMode('Basic: Manual Selection Required');
                    this.showNotification('Basic face detection loaded (recognition disabled)', 'info');
                    
                    // Enable capture button now that basic models are loaded
                    const captureBtn = document.getElementById('captureBtn');
                    if (captureBtn) {
                        captureBtn.disabled = false;
                    }
                } else {
                    throw new Error('face-api.js not available');
                }
            } catch (basicError) {
                console.error('Even basic detection failed:', basicError);
                this.modelsLoaded = false;
                this.fullRecognitionAvailable = false;
                this.updateModelStatus('❌ Model loading failed');
                this.updateRecognitionMode('Failed: No Recognition Available');
                this.showNotification('Face recognition models failed to load. Please refresh the page.', 'error');
            }
        }
    }

    initializeEventListeners() {
        console.log('Setting up event listeners...');
        
        // Camera controls
        const startCameraBtn = document.getElementById('startCamera');
        const stopCameraBtn = document.getElementById('stopCamera');
        const captureBtn = document.getElementById('captureBtn');
        
        if (startCameraBtn) {
            startCameraBtn.addEventListener('click', () => {
                console.log('Start camera clicked');
                this.startCamera();
            });
        } else {
            console.error('Start camera button not found');
        }
        
        if (stopCameraBtn) {
            stopCameraBtn.addEventListener('click', () => {
                console.log('Stop camera clicked');
                this.stopCamera();
            });
        } else {
            console.error('Stop camera button not found');
        }
        
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                console.log('Capture face clicked');
                this.captureFace();
            });
        } else {
            console.error('Capture button not found');
        }

        // Navigation buttons
        const registerBtn = document.getElementById('registerBtn');
        const attendanceBtn = document.getElementById('attendanceBtn');
        const viewRecordsBtn = document.getElementById('viewRecordsBtn');
        
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                console.log('Register button clicked');
                this.showRegistrationForm();
            });
        } else {
            console.error('Register button not found');
        }
        
        if (attendanceBtn) {
            attendanceBtn.addEventListener('click', () => {
                console.log('Attendance button clicked');
                this.showAttendanceSection();
            });
        } else {
            console.error('Attendance button not found');
        }
        
        if (viewRecordsBtn) {
            viewRecordsBtn.addEventListener('click', () => {
                console.log('View records button clicked');
                this.showRecordsSection();
            });
        } else {
            console.error('View records button not found');
        }

        // Registration form
        const userForm = document.getElementById('userForm');
        const cancelRegistration = document.getElementById('cancelRegistration');
        
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                console.log('User form submitted');
                this.handleRegistration(e);
            });
        } else {
            console.error('User form not found');
        }
        
        if (cancelRegistration) {
            cancelRegistration.addEventListener('click', () => {
                console.log('Cancel registration clicked');
                this.hideRegistrationForm();
            });
        } else {
            console.error('Cancel registration button not found');
        }

        // Attendance section buttons
        const startAttendanceBtn = document.getElementById('startAttendance');
        const stopAttendanceBtn = document.getElementById('stopAttendance');
        
        if (startAttendanceBtn) {
            startAttendanceBtn.addEventListener('click', () => this.startAttendance());
        }
        if (stopAttendanceBtn) {
            stopAttendanceBtn.addEventListener('click', () => this.stopAttendance());
        }

        // Location and GPS controls
        const classLocationSelect = document.getElementById('classLocation');
        const refreshLocationsBtn = document.getElementById('refreshLocations');
        const getLocationBtn = document.getElementById('getLocation');

        if (classLocationSelect) {
            classLocationSelect.addEventListener('change', () => this.onLocationChange());
        }
        if (refreshLocationsBtn) {
            refreshLocationsBtn.addEventListener('click', () => this.loadClassLocations());
        }
        if (getLocationBtn) {
            getLocationBtn.addEventListener('click', () => this.getCurrentLocation());
        }

        // Records controls
        const filterRecords = document.getElementById('filterRecords');
        const exportRecords = document.getElementById('exportRecords');
        
        if (filterRecords) {
            filterRecords.addEventListener('click', () => {
                console.log('Filter records clicked');
                this.filterRecords();
            });
        } else {
            console.error('Filter records button not found');
        }
        
        if (exportRecords) {
            exportRecords.addEventListener('click', () => {
                console.log('Export records clicked');
                this.exportRecords();
            });
        } else {
            console.error('Export records button not found');
        }

        // Update time every second
        setInterval(() => this.updateCurrentTime(), 1000);
        
        console.log('Event listeners initialized');
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                } 
            });
            
            this.video.srcObject = stream;
            this.isCameraActive = true;
            
            // Wait for video to be ready
            this.video.onloadedmetadata = () => {
                console.log('Video ready, dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.updateStatus('Camera active');
                this.showNotification('Camera started successfully', 'success');
                
                // Start face detection
                this.startFaceDetection();
            };
            
            document.getElementById('startCamera').disabled = true;
            document.getElementById('stopCamera').disabled = false;
            document.getElementById('captureBtn').disabled = !this.modelsLoaded;
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.showNotification('Error starting camera. Please check permissions.', 'error');
        }
    }

    stopCamera() {
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        this.isCameraActive = false;
        this.stopFaceDetection();
        
        document.getElementById('startCamera').disabled = false;
        document.getElementById('stopCamera').disabled = true;
        document.getElementById('captureBtn').disabled = true;
        
        this.updateStatus('Camera stopped');
        this.hideFaceBox();
    }

    startFaceDetection() {
        this.faceDetectionInterval = setInterval(async () => {
            if (!this.isCameraActive || !this.modelsLoaded) return;
            
            try {
                // Use only basic face detection first
                const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions());
                
                if (detections.length > 0) {
                    const detection = detections[0];
                    this.showFaceBox(detection.box);
                    this.updateStatus(`Face detected (${detections.length} faces)`);
                    console.log('Face detected:', detection.box);
                } else {
                    this.hideFaceBox();
                    this.updateStatus('No face detected');
                }
            } catch (error) {
                console.error('Face detection error:', error);
                this.updateStatus('Face detection error');
            }
        }, 100);
    }

    stopFaceDetection() {
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
        this.hideFaceBox();
    }

    stopRecognition() {
        if (this.recognitionInterval) {
            clearInterval(this.recognitionInterval);
            this.recognitionInterval = null;
        }
        
        // Re-enable start button and disable stop button
        const startAttendanceBtn = document.getElementById('startAttendance');
        const stopAttendanceBtn = document.getElementById('stopAttendance');
        
        if (startAttendanceBtn) startAttendanceBtn.disabled = false;
        if (stopAttendanceBtn) stopAttendanceBtn.disabled = true;
    }

    showFaceBox(box) {
        this.faceBox.style.display = 'block';
        this.faceBox.style.left = box.x + 'px';
        this.faceBox.style.top = box.y + 'px';
        this.faceBox.style.width = box.width + 'px';
        this.faceBox.style.height = box.height + 'px';
        this.faceBox.classList.add('face-detected');
    }

    hideFaceBox() {
        this.faceBox.style.display = 'none';
        this.faceBox.classList.remove('face-detected');
    }

    async captureFace() {
        if (!this.isCameraActive) {
            this.showNotification('Please start camera first', 'error');
            return;
        }

        if (!this.modelsLoaded) {
            this.showNotification('Face recognition models are still loading. Please wait...', 'error');
            return;
        }

        try {
            console.log('Capturing face...');
            
            // Always use full Face ID-style recognition now that all models are loaded
            const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            let faceDescriptor = null;
            if (detections.length > 0) {
                faceDescriptor = detections[0].descriptor;
                console.log('Face captured with full biometric data');
            }
            
            if (detections.length === 0) {
                this.showNotification('No face detected. Please position your face in the camera.', 'error');
                return;
            }

            console.log('Face detected, capturing image...');
            
            // Capture the face image
            this.ctx.drawImage(this.video, 0, 0, 640, 480);
            const faceImageData = this.canvas.toDataURL('image/jpeg');
            
            // Add to captured faces with biometric data if available
            this.capturedFaces.push({
                image: faceImageData,
                descriptor: faceDescriptor
            });
            
            this.updateFaceImages();
            this.showNotification(`Face captured successfully! (${this.capturedFaces.length}/3) - With biometric data`, 'success');
            
        } catch (error) {
            console.error('Error capturing face:', error);
            this.showNotification('Error capturing face: ' + error.message, 'error');
        }
    }

    updateFaceImages() {
        const container = document.getElementById('faceImages');
        container.innerHTML = '';
        
        this.capturedFaces.forEach((face, index) => {
            const faceDiv = document.createElement('div');
            faceDiv.className = 'face-image';
            
            const img = document.createElement('img');
            img.src = face.image;
            img.alt = `Face ${index + 1}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removeFace(index);
            
            faceDiv.appendChild(img);
            faceDiv.appendChild(removeBtn);
            container.appendChild(faceDiv);
        });
    }

    removeFace(index) {
        this.capturedFaces.splice(index, 1);
        this.updateFaceImages();
    }

    async handleRegistration(e) {
        e.preventDefault();
        
        if (this.capturedFaces.length < 3) {
            this.showNotification('Please capture at least 3 face images', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            id: formData.get('id'),
            department: formData.get('department'),
            faces: this.capturedFaces
        };

        try {
            const response = await fetch('/api/register-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                this.showNotification('User registered successfully', 'success');
                this.hideRegistrationForm();
                this.capturedFaces = [];
                this.updateFaceImages();
                e.target.reset();
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Error registering user', 'error');
        }
    }

    startAttendance() {
        if (!this.modelsLoaded) {
            this.showNotification('Face recognition models not loaded yet', 'error');
            return;
        }

        if (!this.currentLocation || !this.selectedClassLocation) {
            this.showNotification('Please select a class location and get GPS location first', 'error');
            return;
        }

        this.isRecognitionActive = true;
        
        // Enable/disable buttons
        const startAttendanceBtn = document.getElementById('startAttendance');
        const stopAttendanceBtn = document.getElementById('stopAttendance');
        
        if (startAttendanceBtn) startAttendanceBtn.disabled = true;
        if (stopAttendanceBtn) stopAttendanceBtn.disabled = false;

        this.startFaceDetection();
        this.startRecognition();
        this.updateRecognitionStatus('Recognition active - looking for faces');
        this.updateRecognitionMode('Recognition active');
    }

    stopAttendance() {
        this.isRecognitionActive = false;
        this.stopFaceDetection();
        this.stopRecognition();
        this.updateRecognitionStatus('Recognition stopped');
        this.updateRecognitionMode('Recognition stopped');
        this.stopGPSWatching(); // Stop GPS watching when attendance is stopped
    }

    async recognizeFace(detection) {
        try {
            // Get registered users from server
            const response = await fetch('/api/get-users');
            if (!response.ok) return null;
            
            const users = await response.json();
            console.log(`🔍 RECOGNITION DEBUG: Loaded ${users.length} users for recognition`);
            
            // Calculate distances to ALL users for comparison
            const userDistances = [];
            
            for (const user of users) {
                console.log(`🔍 Checking user: ${user.name} (${user.faces.length} faces)`);
                let bestDistance = Infinity;
                
                for (const face of user.faces) {
                    if (face.descriptor) {
                        // Convert descriptors to arrays for comparison
                        const detectionArray = Array.from(detection.descriptor);
                        const storedArray = Object.values(face.descriptor);
                        
                        const distance = faceapi.euclideanDistance(detectionArray, storedArray);
                        console.log(`🔍 Comparing with ${user.name}: distance = ${distance.toFixed(4)}`);
                        
                        // Keep the best (lowest) distance for this user
                        if (distance < bestDistance) {
                            bestDistance = distance;
                        }
                    }
                }
                
                if (bestDistance !== Infinity) {
                    userDistances.push({ user, distance: bestDistance });
                    console.log(`🔍 Best distance for ${user.name}: ${bestDistance.toFixed(4)}`);
                }
            }
            
            // Sort by distance (best match first)
            userDistances.sort((a, b) => a.distance - b.distance);
            
            if (userDistances.length === 0) {
                console.log('❌ No valid face descriptors found');
                return null;
            }
            
            const bestMatch = userDistances[0];
            const secondBest = userDistances[1];
            
            // Calculate confidence (lower distance = higher confidence)
            const confidence = Math.max(0, 1 - (bestMatch.distance / 1.0));
            
            // Calculate margin between best and second best
            const margin = secondBest ? (secondBest.distance - bestMatch.distance) : 0;
            
            console.log(`🎯 RECOGNITION RESULTS:`);
            console.log(`🎯 Best match: ${bestMatch.user.name} (distance: ${bestMatch.distance.toFixed(4)})`);
            console.log(`🎯 Second best: ${secondBest ? secondBest.user.name : 'None'} (distance: ${secondBest ? secondBest.distance.toFixed(4) : 'N/A'})`);
            console.log(`🎯 Confidence: ${(confidence * 100).toFixed(1)}%`);
            console.log(`🎯 Margin: ${margin.toFixed(4)}`);
            
            // Recognition criteria:
            // 1. High confidence (> 50%) - Lowered from 70%
            // 2. Significant margin from second best (> 0.05) - Lowered from 0.1
            // 3. Distance is reasonable (< 0.8) - Increased from 0.6
            const isConfident = confidence > 0.5;
            const hasMargin = margin > 0.05;
            const isReasonable = bestMatch.distance < 0.8;
            
            console.log(`🎯 Criteria check:`);
            console.log(`  - High confidence: ${isConfident} (${(confidence * 100).toFixed(1)}% > 50%)`);
            console.log(`  - Good margin: ${hasMargin} (${margin.toFixed(4)} > 0.05)`);
            console.log(`  - Reasonable distance: ${isReasonable} (${bestMatch.distance.toFixed(4)} < 0.8)`);
            
            if (isConfident && hasMargin && isReasonable) {
                console.log(`✅ RECOGNIZED: ${bestMatch.user.name} with ${(confidence * 100).toFixed(1)}% confidence`);
                return bestMatch.user;
            } else {
                console.log(`❌ NOT RECOGNIZED: Criteria not met`);
                console.log(`❌ Failed criteria: confident=${isConfident}, margin=${hasMargin}, reasonable=${isReasonable}`);
                return null;
            }
            
        } catch (error) {
            console.error('Face recognition error:', error);
            return null;
        }
    }

    async markAttendance(user) {
        try {
            console.log('🎯 Attempting to mark attendance for:', user.name);
            console.log('📍 Current location:', this.currentLocation);
            console.log('🏫 Selected class location:', this.selectedClassLocation);
            
            // Validate location before marking attendance
            const locationValidation = await this.validateLocation();
            console.log('🔍 Location validation result:', locationValidation);
            
            if (!locationValidation.valid) {
                this.showNotification(locationValidation.message, 'error');
                return;
            }

            console.log('✅ Location validated, proceeding with attendance marking...');

            const response = await fetch('/api/mark-attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: user.id,
                    timestamp: new Date().toISOString(),
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude,
                    classLocationId: this.selectedClassLocation.id
                })
            });

            console.log('📡 Server response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Server error:', error);
                this.showNotification(error.message || 'Failed to mark attendance', 'error');
                return;
            }

            const result = await response.json();
            console.log('✅ Attendance marked successfully:', result);
            this.showNotification(`${result.status} for ${user.name}`, 'success');
            
            // Update last attendance mark
            this.lastAttendanceMark[user.id] = Date.now();
            
            // Refresh attendance records
            this.loadRecords();
            
        } catch (error) {
            console.error('❌ Error marking attendance:', error);
            this.showNotification('Failed to mark attendance', 'error');
        }
    }

    showRegistrationForm() {
        this.hideAllSections();
        document.getElementById('registrationForm').style.display = 'block';
    }

    hideRegistrationForm() {
        document.getElementById('registrationForm').style.display = 'none';
        this.capturedFaces = [];
        this.updateFaceImages();
    }

    showAttendanceSection() {
        console.log('🔄 Showing attendance section...');
        this.hideAllSections();
        document.getElementById('attendanceSection').style.display = 'block';
        console.log('✅ Attendance section displayed');
        
        // Debug: Check if the section is actually visible
        const attendanceSection = document.getElementById('attendanceSection');
        console.log('🔍 Attendance section element:', attendanceSection);
        console.log('🔍 Attendance section display style:', attendanceSection.style.display);
        console.log('🔍 Attendance section computed display:', window.getComputedStyle(attendanceSection).display);
        
        this.startGPSWatching(); // Start GPS watching when attendance section is shown
        console.log('📍 Started GPS watching');
        
        // Wait a bit for the DOM to update, then load class locations
        setTimeout(() => {
            console.log('⏰ Timeout completed, checking DOM state...');
            
            // Check if the dropdown exists now
            const select = document.getElementById('classLocation');
            console.log('🔍 Select element after timeout:', select);
            
            if (select) {
                console.log('✅ Select element found, loading class locations...');
                this.loadClassLocations(); // Ensure class locations are loaded
                console.log('🔄 Called loadClassLocations after DOM update');
            } else {
                console.error('❌ Select element still not found after timeout!');
                console.log('🔍 Available elements in attendance section:');
                const attendanceSection = document.getElementById('attendanceSection');
                if (attendanceSection) {
                    console.log('🔍 Attendance section children:', attendanceSection.children);
                    
                    // Check for location-selection div specifically
                    const locationSection = attendanceSection.querySelector('.location-selection');
                    console.log('🔍 Location selection div:', locationSection);
                    if (locationSection) {
                        console.log('🔍 Location selection div children:', locationSection.children);
                        const selectInLocation = locationSection.querySelector('#classLocation');
                        console.log('🔍 Select element in location section:', selectInLocation);
                        
                        // Check CSS properties
                        const computedStyle = window.getComputedStyle(locationSection);
                        console.log('🔍 Location section CSS:', {
                            display: computedStyle.display,
                            visibility: computedStyle.visibility,
                            opacity: computedStyle.opacity,
                            height: computedStyle.height,
                            width: computedStyle.width
                        });
                    }
                    
                    console.log('🔍 Looking for elements with "classLocation" ID...');
                    const allElements = attendanceSection.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.id && el.id.includes('class')) {
                            console.log('🔍 Found element with class-related ID:', el.id, el);
                        }
                    });
                }
            }
        }, 200); // Increased timeout to 200ms
    }

    showRecordsSection() {
        this.hideAllSections();
        document.getElementById('recordsSection').style.display = 'block';
        this.loadRecords();
    }

    hideAllSections() {
        document.getElementById('registrationForm').style.display = 'none';
        document.getElementById('attendanceSection').style.display = 'none';
        document.getElementById('recordsSection').style.display = 'none';
    }

    async loadRegisteredUsers() {
        try {
            const response = await fetch('/api/get-users');
            if (!response.ok) return;
            
            const users = await response.json();
            this.registeredUsers = users;
            console.log('Loaded registered users:', users.length);
            return users;
        } catch (error) {
            console.error('Error loading registered users:', error);
            return [];
        }
    }

    showUserSelection(recognizedUser = null) {
        const attendanceSection = document.getElementById('attendanceSection');
        
        // Remove existing user selection if it exists
        const existingSelection = document.getElementById('userSelection');
        if (existingSelection) {
            existingSelection.remove();
        }
        
        // Create user selection
        const userSelection = document.createElement('div');
        userSelection.id = 'userSelection';
        userSelection.className = 'user-selection';
        
        if (recognizedUser) {
            // Show only the recognized user for confirmation
            userSelection.innerHTML = `
                <h3>Confirm Attendance for Recognized User</h3>
                <div class="user-list" id="userList">
                    <div class="user-item recognized-user" data-user-id="${recognizedUser.id}">
                        <span class="user-name">${recognizedUser.name}</span>
                        <span class="user-id">(${recognizedUser.userId})</span>
                        <span class="recognition-badge">✅ Face Recognized</span>
                        <button class="btn btn-success btn-sm mark-attendance-btn" onclick="window.facialRecognition.markAttendanceForUser(${recognizedUser.id}, '${recognizedUser.name}')">
                            Confirm Attendance
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Show all users for manual selection (when no face is recognized)
            userSelection.innerHTML = `
                <h3>Manual User Selection (No Face Recognized)</h3>
                <div class="user-list" id="userList">
                    ${this.registeredUsers.map(user => `
                        <div class="user-item" data-user-id="${user.id}">
                            <span class="user-name">${user.name}</span>
                            <span class="user-id">(${user.userId})</span>
                            <button class="btn btn-warning btn-sm mark-attendance-btn" onclick="window.facialRecognition.markAttendanceForUser(${user.id}, '${user.name}')">
                                Mark Attendance (Manual)
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Insert after the attendance controls
        const attendanceControls = attendanceSection.querySelector('.attendance-controls');
        attendanceControls.parentNode.insertBefore(userSelection, attendanceControls.nextSibling);
        
        // Show the user selection
        userSelection.style.display = 'block';
    }

    hideUserSelection() {
        const userSelection = document.getElementById('userSelection');
        if (userSelection) {
            userSelection.style.display = 'none';
        }
    }

    async markAttendanceForUser(userId, userName) {
        try {
            // Check cooldown period
            const now = Date.now();
            const lastMark = this.lastAttendanceMark[userId] || 0;
            const timeSinceLastMark = now - lastMark;
            
            if (timeSinceLastMark < this.attendanceCooldown) {
                const remainingTime = Math.ceil((this.attendanceCooldown - timeSinceLastMark) / 1000);
                this.showNotification(`${userName} - Please wait ${remainingTime} seconds before marking attendance again`, 'warning');
                return;
            }

            // Find the user object to pass to markAttendance
            const user = this.registeredUsers.find(u => u.id == userId);
            if (!user) {
                this.showNotification('User not found', 'error');
                return;
            }

            // Use the new location-aware markAttendance method
            await this.markAttendance(user);
            
        } catch (error) {
            console.error('Error marking attendance:', error);
            this.showNotification('Error marking attendance', 'error');
        }
    }

    async loadRecords() {
        try {
            const response = await fetch('/api/get-attendance-records');
            if (!response.ok) return;
            
            const records = await response.json();
            this.displayRecords(records);
        } catch (error) {
            console.error('Error loading records:', error);
        }
    }

    displayRecords(records) {
        const tbody = document.getElementById('recordsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        records.forEach(record => {
            const row = document.createElement('tr');
            
            const locationInfo = record.classLocation ? 
                `${record.classLocation.class_name} - ${record.classLocation.building} ${record.classLocation.room}` : 
                'N/A';
            
            const verificationStatus = record.locationVerified ? 
                '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : 
                '<span class="unverified-badge"><i class="fas fa-times-circle"></i> Not Verified</span>';

            row.innerHTML = `
                <td>${record.name}</td>
                <td>${record.userId}</td>
                <td>${record.department}</td>
                <td>${record.date}</td>
                <td>${record.timeIn || 'N/A'}</td>
                <td>${record.timeOut || 'N/A'}</td>
                <td>${record.status}</td>
                <td>${locationInfo}</td>
                <td>${verificationStatus}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async filterRecords() {
        const dateFilter = document.getElementById('dateFilter').value;
        if (!dateFilter) {
            this.loadRecords();
            return;
        }

        try {
            const response = await fetch(`/api/get-attendance-records?date=${dateFilter}`);
            if (!response.ok) return;
            
            const records = await response.json();
            this.displayRecords(records);
        } catch (error) {
            console.error('Error filtering records:', error);
        }
    }

    async exportRecords() {
        try {
            const response = await fetch('/api/export-attendance-records');
            if (!response.ok) return;
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-records-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Records exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting records:', error);
            this.showNotification('Error exporting records', 'error');
        }
    }

    updateStatus(message) {
        const statusText = this.statusIndicator.querySelector('.status-text');
        statusText.textContent = message;
    }

    updateRecognitionStatus(message) {
        document.getElementById('recognitionStatus').textContent = message;
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        document.getElementById('currentTime').textContent = timeString;
    }

    updateModelStatus(message) {
        const modelStatusText = document.getElementById('modelStatusText');
        if (modelStatusText) {
            modelStatusText.textContent = message;
        }
    }

    updateRecognitionMode(message) {
        const statusElement = document.getElementById('recognitionStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Location Management Methods
    
    async loadClassLocations() {
        console.log('🔄 Starting to load class locations...');
        try {
            console.log('📡 Fetching from /api/class-locations...');
            const response = await fetch('/api/class-locations');
            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error('Failed to load class locations');
            }
            
            const locations = await response.json();
            console.log('📡 Received locations:', locations);
            
            this.classLocations = locations;
            console.log('💾 Stored class locations:', this.classLocations);
            
            this.populateLocationDropdown();
            console.log(`📍 Loaded ${this.classLocations.length} class locations`);
        } catch (error) {
            console.error('❌ Error loading class locations:', error);
            this.showNotification('Failed to load class locations', 'error');
        }
    }

    populateLocationDropdown() {
        console.log('🔄 Populating location dropdown...');
        const select = document.getElementById('classLocation');
        console.log('🔍 Found select element:', select);
        
        if (!select) {
            console.error('❌ Select element not found!');
            return;
        }

        // Clear existing options
        select.innerHTML = '<option value="">Select a class location...</option>';
        console.log('🧹 Cleared existing options');
        
        // Add class locations
        this.classLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = `${location.class_name} - ${location.building} ${location.room}`;
            select.appendChild(option);
            console.log('➕ Added option:', option.textContent);
        });
        
        console.log('✅ Dropdown populated with', this.classLocations.length, 'options');
    }

    onLocationChange() {
        const select = document.getElementById('classLocation');
        if (!select) return;

        const locationId = select.value;
        console.log('🏫 Location selection changed:', locationId);
        
        this.selectedClassLocation = this.classLocations.find(loc => loc.id == locationId);
        console.log('🏫 Selected class location:', this.selectedClassLocation);
        
        if (this.selectedClassLocation) {
            this.showLocationInfo();
            this.checkAttendanceReadiness();
        } else {
            this.hideLocationInfo();
            this.checkAttendanceReadiness();
        }
    }

    showLocationInfo() {
        const locationInfo = document.getElementById('locationInfo');
        const locationName = document.getElementById('locationName');
        const locationBuilding = document.getElementById('locationBuilding');
        const locationRadius = document.getElementById('locationRadius');

        if (locationInfo && locationName && locationBuilding && locationRadius) {
            locationName.textContent = this.selectedClassLocation.class_name;
            locationBuilding.textContent = `${this.selectedClassLocation.building} - ${this.selectedClassLocation.room}`;
            locationRadius.textContent = `Radius: ${this.selectedClassLocation.radius_meters}m`;
            locationInfo.style.display = 'block';
        }
    }

    hideLocationInfo() {
        const locationInfo = document.getElementById('locationInfo');
        if (locationInfo) {
            locationInfo.style.display = 'none';
        }
    }

    async getCurrentLocation() {
        console.log('📍 Starting GPS location capture...');
        
        if (!navigator.geolocation) {
            console.error('❌ Geolocation not supported by this browser');
            this.showNotification('Geolocation is not supported by this browser', 'error');
            return;
        }

        try {
            this.updateGPSStatus('Getting location...', 'loading');
            console.log('📍 Requesting GPS location...');
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false, // Changed from true to false for better compatibility
                    timeout: 30000, // Increased from 10000 to 30000 (30 seconds)
                    maximumAge: 300000 // Increased from 60000 to 300000 (5 minutes)
                });
            });

            console.log('📍 GPS position received:', position);
            console.log('📍 Coordinates:', {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            });

            this.currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            this.updateGPSStatus('GPS Active', 'active');
            this.showCoordinates();
            this.checkAttendanceReadiness();
            
            console.log('✅ Current location updated:', this.currentLocation);
            this.showNotification('Location obtained successfully', 'success');
            
        } catch (error) {
            console.error('❌ Error getting location:', error);
            this.updateGPSStatus('GPS Error', 'error');
            this.hideCoordinates();
            this.showNotification('Failed to get location: ' + error.message, 'error');
        }
    }

    startGPSWatching() {
        if (!navigator.geolocation) return;

        try {
            this.gpsWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    this.updateGPSStatus('GPS Active', 'active');
                    this.showCoordinates();
                    this.checkAttendanceReadiness();
                },
                (error) => {
                    console.error('GPS watch error:', error);
                    this.updateGPSStatus('GPS Error', 'error');
                },
                {
                    enableHighAccuracy: false, // Changed from true to false
                    timeout: 30000, // Increased from 10000 to 30000
                    maximumAge: 300000 // Increased from 30000 to 300000
                }
            );
        } catch (error) {
            console.error('Error starting GPS watch:', error);
        }
    }

    stopGPSWatching() {
        if (this.gpsWatchId) {
            navigator.geolocation.clearWatch(this.gpsWatchId);
            this.gpsWatchId = null;
        }
    }

    updateGPSStatus(message, status) {
        const gpsStatus = document.getElementById('gpsStatus');
        if (!gpsStatus) return;

        gpsStatus.textContent = message;
        gpsStatus.className = `gps-indicator ${status}`;
    }

    showCoordinates() {
        const coordinates = document.getElementById('coordinates');
        const latitude = document.getElementById('latitude');
        const longitude = document.getElementById('longitude');
        const accuracy = document.getElementById('accuracy');

        if (coordinates && latitude && longitude && accuracy && this.currentLocation) {
            latitude.textContent = this.currentLocation.latitude.toFixed(6);
            longitude.textContent = this.currentLocation.longitude.toFixed(6);
            accuracy.textContent = Math.round(this.currentLocation.accuracy);
            coordinates.style.display = 'flex';
        }
    }

    hideCoordinates() {
        const coordinates = document.getElementById('coordinates');
        if (coordinates) {
            coordinates.style.display = 'none';
        }
    }

    checkAttendanceReadiness() {
        const startAttendanceBtn = document.getElementById('startAttendance');
        if (!startAttendanceBtn) return;

        const hasLocation = this.selectedClassLocation !== null;
        const hasGPS = this.currentLocation !== null;
        const modelsReady = this.modelsLoaded;

        console.log('🔍 Checking attendance readiness:', {
            hasLocation,
            hasGPS,
            modelsReady,
            selectedClassLocation: this.selectedClassLocation,
            currentLocation: this.currentLocation
        });

        startAttendanceBtn.disabled = !(hasLocation && hasGPS && modelsReady);
        
        if (startAttendanceBtn.disabled) {
            startAttendanceBtn.title = 'Please select a class location and get GPS location first';
            console.log('❌ Attendance button disabled. Requirements not met.');
        } else {
            startAttendanceBtn.title = 'Ready to start attendance recognition';
            console.log('✅ Attendance button enabled. All requirements met.');
        }
    }

    async validateLocation() {
        console.log('🔍 Starting location validation...');
        console.log('📍 Current location:', this.currentLocation);
        console.log('🏫 Selected class location:', this.selectedClassLocation);
        
        if (!this.currentLocation || !this.selectedClassLocation) {
            console.log('❌ Missing location data:', {
                hasCurrentLocation: !!this.currentLocation,
                hasSelectedClassLocation: !!this.selectedClassLocation
            });
            return { valid: false, message: 'Location data not available' };
        }

        try {
            console.log('📡 Sending location validation request...');
            const response = await fetch('/api/validate-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude,
                    classLocationId: this.selectedClassLocation.id
                })
            });

            console.log('📡 Location validation response status:', response.status);

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Location validation error:', error);
                return { valid: false, message: error.message || 'Location validation failed' };
            }

            const result = await response.json();
            console.log('✅ Location validation result:', result);
            
            return { 
                valid: result.isWithinRadius, 
                message: result.isWithinRadius ? 
                    'Location verified successfully' : 
                    `You must be within ${result.radius}m of the class. Current distance: ${result.distance}m`,
                distance: result.distance,
                radius: result.radius
            };
        } catch (error) {
            console.error('❌ Location validation error:', error);
            return { valid: false, message: 'Failed to validate location' };
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    startRecognition() {
        // Load registered users first
        this.loadRegisteredUsers().then(() => {
            this.recognitionInterval = setInterval(async () => {
                if (!this.isRecognitionActive) return;
                
                try {
                    // Always use full Face ID-style recognition now that all models are loaded
                    console.log('Attempting face detection and recognition...');
                    const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    console.log(`Detected ${detections.length} faces`);
                    
                    if (detections.length > 0) {
                        console.log('Face detected with biometric data, attempting automatic recognition...');
                        this.updateRecognitionStatus(`Face detected - Attempting automatic recognition...`);
                        
                        // Try to automatically recognize the person
                        const recognizedUser = await this.recognizeFace(detections[0]);
                        if (recognizedUser) {
                            // Show recognition but don't auto-mark attendance
                            console.log(`🎯 FINAL RECOGNITION RESULT: ${recognizedUser.name} (ID: ${recognizedUser.id})`);
                            this.updateRecognitionStatus(`✅ Recognized: ${recognizedUser.name} - Click "Confirm Attendance" to confirm`);
                            this.showUserSelection(recognizedUser);
                        } else {
                            console.log(`🎯 NO RECOGNITION: Face not recognized`);
                            this.updateRecognitionStatus('Face not recognized - Manual selection required');
                            this.showUserSelection();
                        }
                    } else {
                        console.log('No faces detected in frame');
                        this.updateRecognitionStatus('No face detected');
                        this.hideUserSelection();
                    }
                } catch (error) {
                    console.error('Recognition error:', error);
                    this.updateRecognitionStatus('Detection error: ' + error.message);
                }
            }, 1000); // Check every second
            
            this.updateRecognitionStatus('Attendance monitoring active - Face detected, click "Mark Attendance" to confirm');
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.facialRecognition = new FacialRecognitionAttendance();
}); 
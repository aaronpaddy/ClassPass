class FacialRecognitionAttendance {
    constructor() {
        console.log('Initializing FacialRecognitionAttendance...');
        
        // Check if user is authenticated
        this.checkAuthentication();
        
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
        this.selectedClass = null;
        this.classLocations = [];
        this.gpsWatchId = null;
        
        // Google Maps properties
        this.googleMap = null;
        this.userMarker = null;
        this.classCircle = null;
        this.mapInitialized = false;
        
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
        
        // Initialize back to top button
        this.initBackToTop();
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
            
            console.log('✅ face-api.js library loaded:', typeof faceapi);
            console.log('🔍 Available faceapi methods:', Object.keys(faceapi));
            console.log('🔍 Available nets:', Object.keys(faceapi.nets));
            console.log('🔍 Available detection methods:', typeof faceapi.detectAllFaces);
            console.log('🔍 Available descriptor methods:', typeof faceapi.euclideanDistance);
            
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
        const setupFaceBtn = document.getElementById('setupFaceBtn');
        const attendanceBtn = document.getElementById('attendanceBtn');
        const viewRecordsBtn = document.getElementById('viewRecordsBtn');
        
        if (setupFaceBtn) {
            setupFaceBtn.addEventListener('click', () => {
                console.log('Setup face button clicked');
                this.showRegistrationForm();
            });
        } else {
            console.error('Setup face button not found');
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
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Logout button clicked');
                this.handleLogout();
            });
        } else {
            console.error('Logout button not found');
        }
        
        // Back to landing button
        const backToLandingBtn = document.getElementById('backToLandingBtn');
        if (backToLandingBtn) {
            backToLandingBtn.addEventListener('click', () => {
                console.log('Back to landing button clicked');
                this.goBackToLanding();
            });
        } else {
            console.error('Back to landing button not found');
        }
        
        // Join class button
        const joinClassBtn = document.getElementById('joinClassBtn');
        if (joinClassBtn) {
            joinClassBtn.addEventListener('click', () => {
                console.log('Join class button clicked');
                this.joinClass();
            });
        } else {
            console.error('Join class button not found');
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

        // Location check button
        const checkLocationBtn = document.getElementById('checkLocationBtn');

        if (checkLocationBtn) {
            checkLocationBtn.addEventListener('click', () => this.checkCurrentLocation());
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
            console.log('🔍 Starting face detection...');
            const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            console.log('🔍 Face detections result:', detections);
            console.log('🔍 Number of detections:', detections.length);
            
            let faceDescriptor = null;
            if (detections.length > 0) {
                faceDescriptor = detections[0].descriptor;
                console.log('✅ Face captured with descriptor:', faceDescriptor);
                console.log('✅ Descriptor type:', typeof faceDescriptor);
                console.log('✅ Descriptor length:', faceDescriptor ? faceDescriptor.length : 'null');
            } else {
                console.log('❌ No faces detected');
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
        
        console.log('🔍 Form submission started');
        console.log('🔍 Form element:', e.target);
        
        if (this.capturedFaces.length < 3) {
            this.showNotification('Please capture at least 3 face images', 'error');
            return;
        }

        // Get current user from session
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
            this.showNotification('Please log in first', 'error');
            return;
        }
        
        const currentUser = JSON.parse(userStr);
        console.log('🔍 Current user from session:', currentUser);
        
        // Check if form fields exist and have values
        const nameField = document.getElementById('name');
        const emailField = document.getElementById('email');
        const idField = document.getElementById('id');
        const departmentField = document.getElementById('department');
        
        console.log('🔍 Form fields found:', {
            name: !!nameField,
            email: !!emailField,
            id: !!idField,
            department: !!departmentField
        });
        
        if (!nameField || !emailField || !idField || !departmentField) {
            this.showNotification('Form fields not found. Please refresh the page.', 'error');
            return;
        }
        
        const formData = new FormData(e.target);
        
        // Debug: Check what FormData is collecting
        console.log('🔍 FormData entries:');
        for (let [key, value] of formData.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
        const userData = {
            userId: currentUser.id, // Use existing user ID
            name: formData.get('name'),
            email: formData.get('email'),
            id: formData.get('id'),
            department: formData.get('department'),
            faces: this.capturedFaces
        };

        // Debug: Log what we're sending
        console.log('🔍 Form data being sent:', userData);
        console.log('🔍 FormData contents:', {
            name: formData.get('name'),
            email: formData.get('email'),
            id: formData.get('id'),
            department: formData.get('department')
        });
        console.log('🔍 Captured faces:', this.capturedFaces);
        
        // Debug: Check actual form field values
        console.log('🔍 Actual form field values:', {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            id: document.getElementById('id').value,
            department: document.getElementById('department').value
        });
        
        // Debug: Check if fields are disabled
        console.log('🔍 Form field states:', {
            nameDisabled: document.getElementById('name').disabled,
            emailDisabled: document.getElementById('email').disabled,
            idDisabled: document.getElementById('id').disabled,
            departmentDisabled: document.getElementById('department').disabled
        });
        
        // Check if any required fields are missing
        if (!userData.name || !userData.email || !userData.id || !userData.department) {
            console.error('❌ Missing required fields:', {
                name: !!userData.name,
                email: !!userData.email,
                id: !!userData.id,
                department: !!userData.department
            });
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Use update-user endpoint instead of register-user
            const response = await fetch('/api/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                const result = await response.json();
                
                // Show success modal for face setup completion
                this.showModal(
                    'Face Recognition Setup Complete! 🎉',
                    `
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 48px; margin-bottom: 20px;">👤</div>
                        <h4 style="color: #10b981; margin-bottom: 16px;">Face Recognition Ready!</h4>
                        <p style="text-align: center; color: #94a3b8; margin-bottom: 20px;">
                            <strong>${userData.name}</strong><br>
                            Department: ${userData.department}<br>
                            Faces Captured: ${this.capturedFaces.length}
                        </p>
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-top: 20px;">
                            <strong style="color: #10b981;">You can now use facial recognition for attendance!</strong>
                        </div>
                    </div>
                    `,
                    'success'
                );
                
                this.hideRegistrationForm();
                this.capturedFaces = [];
                this.updateFaceImages();
                e.target.reset();
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Face setup error:', error);
            this.showNotification('Error setting up face recognition', 'error');
        }
    }
    
    handleLogout() {
        // Clear session storage
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('role');
        
        // Show logout message
        this.showNotification('Logged out successfully', 'success');
        
        // Redirect to landing page after a short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
    
    goBackToLanding() {
        // Clear session storage
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('role');
        
        // Redirect to landing page
        window.location.href = '/';
    }
    
    async joinClass() {
        const classCode = document.getElementById('classCodeInput').value.trim().toUpperCase();
        
        if (!classCode) {
            this.showNotification('Please enter a class code', 'error');
            return;
        }
        
        try {
            // Get current user from session
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                this.showNotification('Please log in first', 'error');
                return;
            }
            
            const user = JSON.parse(userStr);
            
            // Enroll student in the class
            const response = await fetch('/api/enroll-student', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    classCode: classCode,
                    studentId: user.id
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.selectedClass = result.class;
                
                // Display class information
                this.displayClassInfo();
                
                // Update map with class location
                this.updateMapWithClass();
                
                // Enable attendance button
                this.updateAttendanceReadiness();
                
                this.showNotification(`Successfully joined ${result.class.name}!`, 'success');
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Join class error:', error);
            this.showNotification('Error joining class', 'error');
        }
    }
    
    displayClassInfo() {
        if (!this.selectedClass) return;
        
        // Update attendance section class info
        document.getElementById('className').textContent = this.selectedClass.name;
        document.getElementById('classCodeDisplay').textContent = this.selectedClass.code;
        document.getElementById('teacherName').textContent = this.selectedClass.teacher_name || 'Unknown';
        document.getElementById('classLocation').textContent = `${this.selectedClass.latitude.toFixed(6)}, ${this.selectedClass.longitude.toFixed(6)}`;
        document.getElementById('attendanceRadius').textContent = `${this.selectedClass.attendance_radius}m`;
        
        document.getElementById('classInfo').style.display = 'block';
        
        // Update records section current class display
        document.getElementById('currentClassName').textContent = this.selectedClass.name;
        document.getElementById('currentClassCode').textContent = this.selectedClass.code;
        document.getElementById('currentClassTeacher').textContent = this.selectedClass.teacher_name || 'Unknown';
        document.getElementById('currentClassDisplay').style.display = 'block';
    }
    
    updateMapWithClass() {
        if (!this.selectedClass || !this.googleMap) return;
        
        // Clear existing markers and circles
        if (this.classCircle) {
            this.classCircle.setMap(null);
        }
        
        // Add class location circle
        this.classCircle = new google.maps.Circle({
            strokeColor: '#60a5fa',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#60a5fa',
            fillOpacity: 0.1,
            map: this.googleMap,
            center: {
                lat: this.selectedClass.latitude,
                lng: this.selectedClass.longitude
            },
            radius: this.selectedClass.attendance_radius
        });
        
        // Center map on class location
        this.googleMap.setCenter({
            lat: this.selectedClass.latitude,
            lng: this.selectedClass.longitude
        });
        
        // Update map status
        this.updateMapStatus(`Class: ${this.selectedClass.name} - Radius: ${this.selectedClass.attendance_radius}m`);
        
        // Enable map controls
        const zoomToClassBtn = document.getElementById('zoomToClass');
        if (zoomToClassBtn) zoomToClassBtn.disabled = false;
    }
    
    updateAttendanceReadiness() {
        const startAttendanceBtn = document.getElementById('startAttendance');
        if (!startAttendanceBtn) return;
        
        const hasLocation = this.currentLocation !== null;
        const hasClass = this.selectedClass !== null;
        const modelsReady = this.modelsLoaded;
        
        console.log('🔍 Checking attendance readiness:', {
            currentLocation: this.currentLocation,
            selectedClass: this.selectedClass,
            hasGPS: this.hasGPS,
            hasLocation: hasLocation,
            modelsReady: modelsReady
        });
        
        if (hasLocation && hasClass && modelsReady) {
            startAttendanceBtn.disabled = false;
            startAttendanceBtn.innerHTML = '<i class="fas fa-play"></i> Start ClassPass';
            console.log('✅ Attendance button enabled. All requirements met.');
        } else {
            startAttendanceBtn.disabled = true;
            startAttendanceBtn.innerHTML = '<i class="fas fa-play"></i> Start ClassPass';
            console.log('❌ Attendance button disabled. Requirements not met.');
        }
    }
    
    checkAuthentication() {
        const userStr = sessionStorage.getItem('user');
        const role = sessionStorage.getItem('role');
        
        if (!userStr || role !== 'student') {
            this.showNotification('Access denied. Please log in as a student.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
        
        const user = JSON.parse(userStr);
        console.log('Authenticated as student:', user.name);
    }

    startAttendance() {
        if (!this.modelsLoaded) {
            this.showNotification('Face recognition models not loaded yet', 'error');
            return;
        }

        if (!this.currentLocation || !this.selectedClass) {
            this.showNotification('Please join a class and get GPS location first', 'error');
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
            // 2. Good margin from second best (> 0.05) OR single user scenario
            // 3. Distance is reasonable (< 0.8) - Increased from 0.6
            const isConfident = confidence > 0.5;
            const hasMargin = margin > 0.05;
            const isSingleUser = userDistances.length === 1; // Special case for single user
            const isReasonable = bestMatch.distance < 0.8;
            
            console.log(`🎯 Criteria check:`);
            console.log(`  - High confidence: ${isConfident} (${(confidence * 100).toFixed(1)}% > 50%)`);
            console.log(`  - Good margin: ${hasMargin} (${margin.toFixed(4)} > 0.05)`);
            console.log(`  - Single user scenario: ${isSingleUser} (${userDistances.length} users total)`);
            console.log(`  - Reasonable distance: ${isReasonable} (${bestMatch.distance.toFixed(4)} < 0.8)`);
            
            // For single user, we only need confidence and reasonable distance
            // For multiple users, we also need margin
            const isRecognized = isConfident && isReasonable && (isSingleUser || hasMargin);
            
            if (isRecognized) {
                console.log(`✅ RECOGNIZED: ${bestMatch.user.name} with ${(confidence * 100).toFixed(1)}% confidence`);
                return bestMatch.user;
            } else {
                console.log(`❌ NOT RECOGNIZED: Criteria not met`);
                console.log(`❌ Failed criteria: confident=${isConfident}, margin=${hasMargin}, singleUser=${isSingleUser}, reasonable=${isReasonable}`);
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
            console.log('🏫 Selected class:', this.selectedClass);
            
            if (!this.selectedClass) {
                this.showNotification('Please join a class first', 'error');
                return;
            }
            
            if (!this.currentLocation) {
                this.showNotification('Please get your GPS location first', 'error');
                return;
            }

            console.log('✅ Location and class validated, proceeding with attendance marking...');

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
                    classCode: this.selectedClass.code
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
            
            // Show success modal for important actions
            this.showModal(
                'Attendance Marked Successfully! 🎉',
                `
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                    <h4 style="color: #10b981; margin-bottom: 16px;">${result.status} for ${user.name}</h4>
                    <p style="text-align: left; color: #94a3b8; margin-bottom: 20px;">
                        <strong>Class:</strong> ${result.class || this.selectedClass?.name || 'Unknown'}<br>
                        <strong>Time:</strong> ${new Date().toLocaleTimeString()}<br>
                        <strong>Date:</strong> ${new Date().toLocaleDateString()}<br>
                        <strong>Distance:</strong> ${result.distance || 'Unknown'}m (within ${this.selectedClass?.attendance_radius || 'class'} radius)<br>
                        <strong>Location Verified:</strong> ${result.locationVerified ? '✅ Yes' : '❌ No'}
                    </p>
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-top: 20px;">
                        <strong style="color: #10b981;">Attendance Recorded Successfully!</strong>
                    </div>
                </div>
                `,
                'success'
            );
            
            // Update last attendance mark
            this.lastAttendanceMark[user.id] = Date.now();
            
            // Stop face recognition after successful attendance marking
            this.stopAttendance();
            
            // Hide user selection to prevent multiple clicks
            this.hideUserSelection();
            
            // Update recognition status to show completion
            this.updateRecognitionStatus('Attendance marked successfully - Recognition stopped');
            
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
        
        // Pre-fill form with existing user data
        this.prefillRegistrationForm();
        
        // Auto-scroll to registration form with smooth animation
        const registrationForm = document.getElementById('registrationForm');
        if (registrationForm) {
            setTimeout(() => {
                registrationForm.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }, 100);
        }
    }

    prefillRegistrationForm() {
        // Get current user from session
        const userStr = sessionStorage.getItem('user');
        if (!userStr) return;
        
        const user = JSON.parse(userStr);
        
        // Pre-fill the form fields
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const idInput = document.getElementById('id');
        const departmentInput = document.getElementById('department');
        
        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (idInput) idInput.value = user.user_id || '';
        if (departmentInput) departmentInput.value = user.department || '';
        
        // Make email field readonly since it can't be changed
        if (emailInput) emailInput.readOnly = true;
        
        console.log('✅ Pre-filled registration form with user data:', user);
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
        
        // Auto-scroll to attendance section with smooth animation
        const attendanceSection = document.getElementById('attendanceSection');
        if (attendanceSection) {
            setTimeout(() => {
                attendanceSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }, 100);
        }
        
        // Load enrolled classes for the student
        this.loadEnrolledClasses();
        
        this.startGPSWatching(); // Start GPS watching when attendance section is shown
        console.log('📍 Started GPS watching');
        
        // Try to get location automatically after a short delay
        setTimeout(() => {
            if (!this.currentLocation) {
                console.log('📍 Attempting automatic location detection...');
                this.getCurrentLocation();
            }
        }, 1000);
        
        // Initialize location validation
        console.log('📍 Initializing location validation...');
        this.initializeLocationValidation();
    }

    showRecordsSection() {
        this.hideAllSections();
        document.getElementById('recordsSection').style.display = 'block';
        this.loadRecords();
        
        // Auto-scroll to records section with smooth animation
        const recordsSection = document.getElementById('recordsSection');
        if (recordsSection) {
            setTimeout(() => {
                recordsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }, 100);
        }
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
            // Get current user from session
            const userStr = sessionStorage.getItem('user');
            if (!userStr) return;
            
            const currentUser = JSON.parse(userStr);
            
            // Get attendance records for the current user
            const response = await fetch(`/api/get-attendance-records?userId=${currentUser.id}`);
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

        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 32px;">
                        <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 8px;"></i><br>
                        No attendance records found yet
                    </td>
                </tr>
            `;
            return;
        }

        records.forEach(record => {
            const row = document.createElement('tr');
            
            const verificationStatus = record.locationVerified ? 
                '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : 
                '<span class="unverified-badge"><i class="fas fa-times-circle"></i> Not Verified</span>';

            row.innerHTML = `
                <td>${record.date}</td>
                <td>${record.timeIn || 'N/A'}</td>
                <td>${record.timeOut || 'N/A'}</td>
                <td>${record.className}</td>
                <td>${record.locationVerified ? 'Within radius' : 'Outside radius'}</td>
                <td>${verificationStatus}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async filterRecords() {
        const dateFilter = document.getElementById('dateFilter').value;
        
        // Get current user from session
        const userStr = sessionStorage.getItem('user');
        if (!userStr) return;
        
        const currentUser = JSON.parse(userStr);
        
        if (!dateFilter) {
            this.loadRecords();
            return;
        }

        try {
            const response = await fetch(`/api/get-attendance-records?date=${dateFilter}&userId=${currentUser.id}`);
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
        
        if (this.selectedClass) {
            this.showLocationInfo();
            this.updateAttendanceReadiness();
            
            // Update Google Maps if available
            if (this.mapInitialized) {
                this.updateClassCircle();
                this.updateMapStatus(`Class location: ${this.selectedClassLocation.class_name}`);
                
                // Center map on class location
                const classLatLng = new google.maps.LatLng(
                    this.selectedClassLocation.latitude,
                    this.selectedClassLocation.longitude
                );
                this.googleMap.setCenter(classLatLng);
                this.googleMap.setZoom(17);
            }
        } else {
            this.hideLocationInfo();
            this.updateAttendanceReadiness();
            
            // Clear class circle from map
            if (this.classCircle) {
                this.classCircle.setMap(null);
                this.classCircle = null;
            }
            
            if (this.mapInitialized) {
                this.updateMapStatus('Select a class location to see the map');
            }
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
                    enableHighAccuracy: false, // Better compatibility
                    timeout: 60000, // Increased to 60 seconds
                    maximumAge: 600000 // Increased to 10 minutes (cache longer)
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
            this.updateAttendanceReadiness();
            
            // Update Google Maps if available
            if (this.mapInitialized) {
                this.updateUserMarker();
                this.updateMapStatus('Location updated - You are marked with a blue dot');
                
                // If class is selected, validate location
                if (this.selectedClass) {
                    await this.validateLocationWithGoogleMaps();
                }
            }
            
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
            // First, try to get current position immediately
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('📍 Got immediate GPS position');
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    this.updateGPSStatus('GPS Active', 'active');
                    this.showCoordinates();
                    this.updateAttendanceReadiness();
                    
                    // Update Google Maps if available
                    if (this.mapInitialized) {
                        this.updateUserMarker();
                        this.updateMapStatus('Location obtained automatically!');
                        
                        // If class is selected, validate location
                        if (this.selectedClass) {
                            this.validateLocationWithGoogleMaps();
                        }
                    }
                },
                (error) => {
                    console.log('📍 Immediate GPS failed, will try watching:', error.message);
                    this.updateGPSStatus('GPS Waiting...', 'loading');
                },
                {
                    enableHighAccuracy: false,
                    timeout: 30000,
                    maximumAge: 600000 // 10 minutes cache
                }
            );

            // Then start watching for position changes
            this.gpsWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    console.log('📍 GPS position updated via watch');
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    this.updateGPSStatus('GPS Active', 'active');
                    this.showCoordinates();
                    this.updateAttendanceReadiness();
                    
                    // Update Google Maps if available
                    if (this.mapInitialized) {
                        this.updateUserMarker();
                        this.updateMapStatus('Location updated automatically');
                        
                        // If class is selected, validate location
                        if (this.selectedClass) {
                            this.validateLocationWithGoogleMaps();
                        }
                    }
                },
                (error) => {
                    console.error('GPS watch error:', error);
                    this.updateGPSStatus('GPS Error', 'error');
                },
                {
                    enableHighAccuracy: false,
                    timeout: 30000,
                    maximumAge: 300000
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
                hasSelectedLocation: !!this.selectedClassLocation
            });
            return { valid: false, message: 'Location data not available' };
        }

        // Use Google Maps for precise location validation
        if (this.mapInitialized && typeof google !== 'undefined') {
            console.log('🗺️ Using Google Maps for location validation...');
            return await this.validateLocationWithGoogleMaps();
        } else {
            console.log('📡 Falling back to server validation...');
            return await this.validateLocationWithServer();
        }
    }
    
    async validateLocationWithServer() {
        try {
            console.log('📡 Sending location validation request to server...');
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
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(notification);
        
        // Show notification with slide-in animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remove notification after 6 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 400);
        }, 6000);
    }
    
    showModal(title, content, type = 'info') {
        const modalOverlay = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalClose = document.getElementById('modalClose');
        
        if (!modalOverlay || !modalTitle || !modalBody || !modalClose) return;
        
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        
        // Add icon based on type
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        modalTitle.innerHTML = `<i class="fas fa-${icon}"></i> ${title}`;
        
        modalOverlay.style.display = 'flex';
        
        // Close modal when clicking close button or overlay
        const closeModal = () => {
            modalOverlay.style.display = 'none';
        };
        
        modalClose.onclick = closeModal;
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) closeModal();
        };
        
        // Auto-close after 8 seconds for info modals
        if (type === 'warning') {
            setTimeout(closeModal, 8000);
        }
    }
    
    initBackToTop() {
        const backToTopBtn = document.getElementById('backToTop');
        if (!backToTopBtn) return;
        
        // Show/hide button based on scroll position
        const toggleBackToTop = () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        };
        
        // Scroll to top when clicked
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Listen for scroll events
        window.addEventListener('scroll', toggleBackToTop);
        
        // Initial check
        toggleBackToTop();
    }

    startRecognition() {
        // Load registered users first
        this.loadRegisteredUsers().then(() => {
            this.recognitionInterval = setInterval(async () => {
                if (!this.isRecognitionActive) return;
                
                try {
                    // Always use full Face ID-style recognition now that all models are loaded
                    console.log('🔍 Attempting face detection and recognition...');
                    const detections = await faceapi.detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    console.log('🔍 Face detections result:', detections);
                    console.log('🔍 Number of detections:', detections.length);
                    
                    if (detections.length > 0) {
                        console.log('✅ Face detected with biometric data, attempting automatic recognition...');
                        console.log('🔍 First detection:', detections[0]);
                        console.log('🔍 Has descriptor:', !!detections[0].descriptor);
                        console.log('🔍 Descriptor type:', typeof detections[0].descriptor);
                        
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
                            this.updateRecognitionStatus('Face not recognized');
                            this.showUserSelection();
                        }
                    } else {
                        console.log('❌ No faces detected in frame');
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

    // Google Maps Integration Methods
    
    initializeGoogleMaps() {
        console.log('🗺️ Initializing Google Maps...');
        
        // Wait for Google Maps to be fully loaded
        const checkGoogleMaps = () => {
            if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                console.log('⏳ Google Maps not ready yet, waiting...');
                setTimeout(checkGoogleMaps, 500);
                return;
            }
            
            console.log('✅ Google Maps API detected, initializing map...');
            
            try {
                const mapElement = document.getElementById('googleMap');
                if (!mapElement) {
                    console.error('❌ Map element not found');
                    return;
                }
                
                // Initialize the map with simpler options
                this.googleMap = new google.maps.Map(mapElement, {
                    zoom: 15,
                    center: { lat: 0, lng: 0 },
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true
                });
                
                this.mapInitialized = true;
                console.log('✅ Google Maps initialized successfully');
                this.updateMapStatus('Map ready - Select a class location');
                
                // Add map click listener for debugging
                this.googleMap.addListener('click', (event) => {
                    console.log('🗺️ Map clicked at:', event.latLng.lat(), event.latLng.lng());
                });
                
            } catch (error) {
                console.error('❌ Error initializing Google Maps:', error);
                this.showMapError('Failed to initialize map: ' + error.message);
            }
        };
        
        // Start checking for Google Maps
        checkGoogleMaps();
        
        // Set a timeout to show fallback if Google Maps doesn't load
        setTimeout(() => {
            if (!this.mapInitialized) {
                console.log('⏰ Google Maps timeout - showing fallback mode');
                this.showMapFallback();
            }
        }, 10000); // 10 second timeout
    }
    
    showMapFallback() {
        const mapElement = document.getElementById('googleMap');
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="map-fallback">
                    <div class="fallback-header">
                        <i class="fas fa-map-marked-alt"></i>
                        <h4>Location Validation Mode</h4>
                    </div>
                    <div class="fallback-content">
                        <p>Google Maps is not available, but location validation still works!</p>
                        <div class="fallback-features">
                            <div class="feature">
                                <i class="fas fa-check-circle"></i>
                                <span>GPS location tracking</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-check-circle"></i>
                                <span>Distance calculations</span>
                            </div>
                            <div class="feature">
                                <i class="fas fa-check-circle"></i>
                                <span>Attendance validation</span>
                            </div>
                        </div>
                        <div class="api-key-info">
                            <strong>To enable Google Maps:</strong>
                            <ol>
                                <li>Get API key from <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                                <li>Replace 'YOUR_API_KEY' in attendance.html</li>
                                <li>Refresh the page</li>
                            </ol>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    getMapStyles() {
        return [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'transit',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ];
    }
    
    updateMapStatus(message) {
        const mapStatus = document.getElementById('mapStatus');
        if (mapStatus) {
            const span = mapStatus.querySelector('span');
            if (span) span.textContent = message;
        }
    }
    
    showMapError(message) {
        const mapElement = document.getElementById('googleMap');
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>${message}</div>
                    <div style="margin: 16px 0; padding: 16px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                        <strong>Fallback Mode:</strong> Using basic location validation
                    </div>
                    <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 16px;">
                        <i class="fas fa-redo"></i> Reload Page
                    </button>
                </div>
            `;
        }
    }
    
    centerMapOnUser() {
        if (!this.googleMap || !this.currentLocation) {
            this.showNotification('No location data available', 'error');
            return;
        }
        
        const userLatLng = new google.maps.LatLng(
            this.currentLocation.latitude,
            this.currentLocation.longitude
        );
        
        this.googleMap.setCenter(userLatLng);
        this.googleMap.setZoom(18);
        
        console.log('🗺️ Centered map on user location');
        this.updateMapStatus('Centered on your location');
    }
    
    zoomToClassLocation() {
        if (!this.googleMap || !this.selectedClassLocation) {
            this.showNotification('No class location selected', 'error');
            return;
        }
        
        const classLatLng = new google.maps.LatLng(
            this.selectedClassLocation.latitude,
            this.selectedClassLocation.longitude
        );
        
        this.googleMap.setCenter(classLatLng);
        this.googleMap.setZoom(17);
        
        console.log('🗺️ Zoomed to class location');
        this.updateMapStatus('Showing class area');
    }
    
    updateUserMarker() {
        if (!this.googleMap || !this.currentLocation) return;
        
        const userLatLng = new google.maps.LatLng(
            this.currentLocation.latitude,
            this.currentLocation.longitude
        );
        
        // Remove existing marker
        if (this.userMarker) {
            this.userMarker.setMap(null);
        }
        
        // Create new user marker
        this.userMarker = new google.maps.Marker({
            position: userLatLng,
            map: this.googleMap,
            title: 'Your Location',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
            }
        });
        
        console.log('📍 Updated user marker on map');
    }
    
    updateClassCircle() {
        if (!this.googleMap || !this.selectedClassLocation) return;
        
        const classLatLng = new google.maps.LatLng(
            this.selectedClassLocation.latitude,
            this.selectedClassLocation.longitude
        );
        
        // Remove existing circle
        if (this.classCircle) {
            this.classCircle.setMap(null);
        }
        
        // Create class location circle
        this.classCircle = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.1,
            map: this.googleMap,
            center: classLatLng,
            radius: this.selectedClassLocation.radius_meters || 50
        });
        
        console.log('🏫 Updated class circle on map');
    }
    
    async validateLocationWithGoogleMaps() {
        if (!this.currentLocation || !this.selectedClassLocation) {
            return { valid: false, message: 'Location data not available' };
        }
        
        try {
            const userLatLng = new google.maps.LatLng(
                this.currentLocation.latitude,
                this.currentLocation.longitude
            );
            
            const classLatLng = new google.maps.LatLng(
                this.selectedClassLocation.latitude,
                this.selectedClassLocation.longitude
            );
            
            // Use Google's precise distance calculation
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                userLatLng,
                classLatLng
            );
            
            const radius = this.selectedClassLocation.radius_meters || 50;
            const isWithinRadius = distance <= radius;
            
            // Update map display
            this.updateUserMarker();
            this.updateClassCircle();
            
            // Update validation display
            this.updateLocationValidation(isWithinRadius, distance, radius);
            
            return {
                valid: isWithinRadius,
                message: isWithinRadius ? 
                    'Location verified successfully' : 
                    `You must be within ${radius}m of the class. Current distance: ${Math.round(distance)}m`,
                distance: Math.round(distance),
                radius: radius
            };
            
        } catch (error) {
            console.error('❌ Error validating location with Google Maps:', error);
            return { valid: false, message: 'Location validation failed' };
        }
    }
    
    updateLocationValidation(isValid, distance, radius) {
        const validationDiv = document.getElementById('locationValidation');
        const validationMessage = document.getElementById('validationMessage');
        const distanceToClass = document.getElementById('distanceToClass');
        const classRadius = document.getElementById('classRadius');
        
        if (validationDiv && validationMessage && distanceToClass && classRadius) {
            validationDiv.style.display = 'flex';
            
            if (isValid) {
                validationMessage.textContent = 'Location verified successfully';
                validationMessage.style.color = '#27ae60';
                validationDiv.style.background = 'rgba(39, 174, 96, 0.1)';
                validationDiv.style.borderColor = 'rgba(39, 174, 96, 0.3)';
            } else {
                validationMessage.textContent = 'Location not verified';
                validationMessage.style.color = '#e74c3c';
                validationDiv.style.background = 'rgba(231, 74, 60, 0.1)';
                validationDiv.style.borderColor = 'rgba(231, 74, 60, 0.3)';
            }
            
            distanceToClass.textContent = distance;
            classRadius.textContent = radius;
        }
        
        // Enable/disable location check button
        const checkLocationBtn = document.getElementById('checkLocationBtn');
        
        if (checkLocationBtn) checkLocationBtn.disabled = !this.currentLocation;
    }

    checkCurrentLocation() {
        if (!this.currentLocation) {
            this.showNotification('No location data available. Please enable GPS.', 'error');
            return;
        }

        if (!this.selectedClass) {
            this.showNotification('Please join a class first to check location.', 'info');
            return;
        }

        // Calculate distance to class
        const distance = this.calculateDistance(
            this.currentLocation.latitude,
            this.currentLocation.longitude,
            this.selectedClass.latitude,
            this.selectedClass.longitude
        );

        const isWithinRadius = distance <= this.selectedClass.attendance_radius;
        
        // Show location validation
        this.updateLocationValidation(isWithinRadius, distance, this.selectedClass.attendance_radius);
        
        // Update status info
        const statusInfo = document.getElementById('statusInfo');
        if (statusInfo) {
            if (isWithinRadius) {
                statusInfo.innerHTML = `
                    <i class="fas fa-check-circle" style="color: #10b981;"></i>
                    <span>Location verified! You're within ${this.selectedClass.attendance_radius}m of ${this.selectedClass.name}</span>
                `;
            } else {
                statusInfo.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
                    <span>Too far from class. Distance: ${Math.round(distance)}m (max: ${this.selectedClass.attendance_radius}m)</span>
                `;
            }
        }

        this.showNotification(
            isWithinRadius ? 
                `Location verified! Distance: ${Math.round(distance)}m` : 
                `Too far from class. Distance: ${Math.round(distance)}m`,
            isWithinRadius ? 'success' : 'warning'
        );
    }

    // Simple location validation without Google Maps
    initializeLocationValidation() {
        console.log('📍 Initializing location validation...');
        this.locationValidationReady = true;
        console.log('✅ Location validation ready');
    }

    // Load enrolled classes for the current student
    async loadEnrolledClasses() {
        try {
            // Get current user from session
            const userStr = sessionStorage.getItem('user');
            if (!userStr) return;
            
            const user = JSON.parse(userStr);
            
            // Fetch enrolled classes from the server
            const response = await fetch(`/api/get-enrolled-classes?studentId=${user.id}`);
            if (!response.ok) {
                console.error('Failed to load enrolled classes');
                return;
            }
            
            const enrolledClasses = await response.json();
            console.log('📚 Loaded enrolled classes:', enrolledClasses);
            
            // Display enrolled classes
            this.displayEnrolledClasses(enrolledClasses);
            
        } catch (error) {
            console.error('Error loading enrolled classes:', error);
        }
    }

    // Display enrolled classes in the UI
    displayEnrolledClasses(classes) {
        const enrolledClassesDiv = document.getElementById('enrolledClasses');
        const enrolledClassesList = document.getElementById('enrolledClassesList');
        
        if (!enrolledClassesDiv || !enrolledClassesList) return;
        
        if (classes.length === 0) {
            // No enrolled classes, hide the section
            enrolledClassesDiv.style.display = 'none';
            return;
        }
        
        // Show the enrolled classes section
        enrolledClassesDiv.style.display = 'block';
        
        // Clear existing list
        enrolledClassesList.innerHTML = '';
        
        // Add each enrolled class
        classes.forEach(classInfo => {
            const classCard = document.createElement('div');
            classCard.className = 'enrolled-class-card';
            classCard.onclick = () => this.selectEnrolledClass(classInfo);
            
            classCard.innerHTML = `
                <div class="enrolled-class-info">
                    <h4>${classInfo.name}</h4>
                    <p><strong>Code:</strong> ${classInfo.code}</p>
                    <p><strong>Teacher:</strong> ${classInfo.teacher_name}</p>
                </div>
                <div class="enrolled-class-actions">
                    <button class="btn btn-success btn-sm">
                        <i class="fas fa-play"></i> Select
                    </button>
                </div>
            `;
            
            enrolledClassesList.appendChild(classCard);
        });
    }

    // Handle selecting an enrolled class
    selectEnrolledClass(classInfo) {
        console.log('🎯 Selected enrolled class:', classInfo);
        
        // Set the selected class
        this.selectedClass = classInfo;
        
        // Display class information
        this.displayClassInfo();
        
        // Update map with class location
        this.updateMapWithClass();
        
        // Enable attendance button
        this.updateAttendanceReadiness();
        
        // Show success message
        this.showNotification(`Selected ${classInfo.name}! Ready for attendance.`, 'success');
        
        // Hide the enrolled classes section since a class is selected
        document.getElementById('enrolledClasses').style.display = 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.facialRecognition = new FacialRecognitionAttendance();
}); 
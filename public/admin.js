class ClassPassAdmin {
    constructor() {
        console.log('Initializing ClassPassAdmin...');
        
        // Check if user is authenticated and is a teacher
        this.checkAuthentication();
        
        this.currentLocation = null;
        this.classes = [];
        this.selectedClassForRecords = null;
        
        this.initializeEventListeners();
        this.initBackToTop();
        this.startGPSWatching();
        
        console.log('ClassPassAdmin initialized');
    }
    
    checkAuthentication() {
        const userStr = sessionStorage.getItem('user');
        const role = sessionStorage.getItem('role');
        
        if (!userStr || role !== 'teacher') {
            this.showNotification('Access denied. Please log in as a teacher.', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
        
        const user = JSON.parse(userStr);
        console.log('Authenticated as teacher:', user.name);
    }
    
    initializeEventListeners() {
        // Header buttons
        document.getElementById('backToLandingBtn').addEventListener('click', () => this.goBackToLanding());
        document.getElementById('createClassBtn').addEventListener('click', () => this.showCreateClassForm());
        document.getElementById('viewAttendanceBtn').addEventListener('click', () => this.showAttendanceRecords());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Form buttons
        document.getElementById('cancelCreateBtn').addEventListener('click', () => this.hideCreateClassForm());
        document.getElementById('setLocationBtn').addEventListener('click', () => this.setCurrentLocation());
        
        // Form submission
        document.getElementById('classForm').addEventListener('submit', (e) => this.handleCreateClass(e));
        
        // Attendance records
        document.getElementById('selectedClassForRecords').addEventListener('change', (e) => this.onClassSelectionChange(e));
        document.getElementById('filterRecords').addEventListener('click', () => this.filterRecords());
        document.getElementById('exportRecords').addEventListener('click', () => this.exportRecords());
        
        // Modal close
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeModal();
            }
        });
    }
    
    initBackToTop() {
        const backToTopBtn = document.getElementById('backToTop');
        if (!backToTopBtn) return;
        
        const toggleBackToTop = () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        };
        
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        window.addEventListener('scroll', toggleBackToTop);
        toggleBackToTop();
    }
    
    startGPSWatching() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by this browser', 'error');
            this.updateGPSStatus('GPS Not Supported', 'error');
            return;
        }
        
        this.updateGPSStatus('GPS Active', 'loading');
        
        // Get current position first
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                this.updateGPSStatus('GPS Active', 'ready');
                this.updateLocationStatus('Location obtained');
                this.loadClasses();
            },
            (error) => {
                console.error('GPS Error:', error);
                this.updateGPSStatus('GPS Error', 'error');
                this.updateLocationStatus('Location failed');
                this.loadClasses(); // Load classes anyway
            },
            {
                enableHighAccuracy: false,
                timeout: 30000,
                maximumAge: 600000
            }
        );
        
        // Watch for position changes
        this.gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                this.updateGPSStatus('GPS Active', 'ready');
                this.updateLocationStatus('Location updated');
            },
            (error) => {
                console.error('GPS Watch Error:', error);
                this.updateGPSStatus('GPS Error', 'error');
            },
            {
                enableHighAccuracy: false,
                timeout: 30000,
                maximumAge: 300000
            }
        );
    }
    
    updateGPSStatus(text, status) {
        const gpsStatusText = document.getElementById('gpsStatusText');
        const systemStatus = document.getElementById('systemStatus');
        const systemStatusText = document.getElementById('systemStatusText');
        
        if (gpsStatusText) gpsStatusText.textContent = text;
        if (systemStatus) systemStatus.className = `fas fa-circle status-indicator ${status}`;
        if (systemStatusText) systemStatusText.textContent = status === 'ready' ? 'System Ready' : 'System Loading...';
    }
    
    updateLocationStatus(text) {
        const locationStatus = document.getElementById('locationStatus');
        if (locationStatus) locationStatus.textContent = text;
    }
    
    showCreateClassForm() {
        document.getElementById('createClassForm').style.display = 'block';
        document.getElementById('classManagementSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
    
    hideCreateClassForm() {
        document.getElementById('createClassForm').style.display = 'none';
        document.getElementById('classForm').reset();
    }
    
    showAttendanceRecords() {
        document.getElementById('attendanceRecordsSection').style.display = 'block';
        document.getElementById('classManagementSection').style.display = 'none';
        document.getElementById('attendanceRecordsSection').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        this.loadClassesForRecords();
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
    
    async setCurrentLocation() {
        if (!this.currentLocation) {
            this.showNotification('Please wait for GPS location to be obtained', 'warning');
            return;
        }
        
        const locationInfo = document.getElementById('locationInfo');
        locationInfo.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px;">
                <p style="color: #10b981; margin-bottom: 8px;"><i class="fas fa-check-circle"></i> Location Set Successfully!</p>
                <p style="color: #94a3b8; font-size: 14px;">
                    Latitude: ${this.currentLocation.latitude.toFixed(6)}<br>
                    Longitude: ${this.currentLocation.longitude.toFixed(6)}<br>
                    Accuracy: ${this.currentLocation.accuracy.toFixed(1)}m
                </p>
            </div>
        `;
        
        this.showNotification('Class location set to your current GPS position', 'success');
    }
    
    async handleCreateClass(e) {
        e.preventDefault();
        
        if (!this.currentLocation) {
            this.showNotification('Please set your current location first', 'error');
            return;
        }
        
        const formData = new FormData(e.target);
        // Get current user from session storage
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
            this.showNotification('Please log in first', 'error');
            return;
        }
        
        const user = JSON.parse(userStr);
        if (user.role !== 'teacher') {
            this.showNotification('Access denied. Teachers only.', 'error');
            return;
        }
        
        const classData = {
            name: formData.get('className'),
            code: formData.get('classCode').toUpperCase(),
            description: formData.get('classDescription'),
            attendanceRadius: parseInt(formData.get('attendanceRadius')),
            latitude: this.currentLocation.latitude,
            longitude: this.currentLocation.longitude,
            teacherId: user.id
        };
        
        try {
            const response = await fetch('/api/create-class', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(classData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showModal(
                    'Class Created Successfully! 🎉',
                    `
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📚</div>
                        <h4 style="color: #10b981; margin-bottom: 16px;">${classData.name}</h4>
                        <p style="color: #94a3b8; margin-bottom: 20px;">
                            Class Code: <strong style="color: #60a5fa;">${classData.code}</strong><br>
                            Attendance Radius: <strong>${classData.attendanceRadius}m</strong><br>
                            Location: Set to your current position
                        </p>
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-top: 20px;">
                            <strong style="color: #10b981;">Students can now join using this class code!</strong>
                        </div>
                    </div>
                    `,
                    'success'
                );
                
                this.hideCreateClassForm();
                this.loadClasses();
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Create class error:', error);
            this.showNotification('Error creating class', 'error');
        }
    }
    
    async loadClasses() {
        try {
            // Get current user from session storage
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                this.showNotification('Please log in first', 'error');
                return;
            }
            
            const user = JSON.parse(userStr);
            if (user.role !== 'teacher') {
                this.showNotification('Access denied. Teachers only.', 'error');
                return;
            }
            
            const response = await fetch(`/api/get-classes?teacherId=${user.id}`);
            if (!response.ok) {
                throw new Error('Failed to load classes');
            }
            
            this.classes = await response.json();
            this.displayClasses();
        } catch (error) {
            console.error('Load classes error:', error);
            this.showNotification('Error loading classes', 'error');
        }
    }
    
    displayClasses() {
        const classesList = document.getElementById('classesList');
        
        if (this.classes.length === 0) {
            classesList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                    <i class="fas fa-chalkboard" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                    <p>No classes created yet</p>
                    <p>Click "Create New Class" to get started</p>
                </div>
            `;
            return;
        }
        
        classesList.innerHTML = this.classes.map(classItem => `
            <div class="class-card">
                <div class="class-header">
                    <div class="class-name">${classItem.name}</div>
                    <div class="class-code">${classItem.code}</div>
                </div>
                <div class="class-details">
                    <div class="class-detail">
                        <i class="fas fa-info-circle"></i>
                        <span>${classItem.description || 'No description'}</span>
                    </div>
                    <div class="class-detail">
                        <i class="fas fa-ruler"></i>
                        <span>${classItem.attendanceRadius}m radius</span>
                    </div>
                    <div class="class-detail">
                        <i class="fas fa-users"></i>
                        <span>${classItem.studentCount || 0} students</span>
                    </div>
                    <div class="class-detail">
                        <i class="fas fa-calendar"></i>
                        <span>Created ${new Date(classItem.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="class-actions">
                    <button class="btn btn-info btn-sm" onclick="admin.viewClassAttendance('${classItem.id}')">
                        <i class="fas fa-chart-bar"></i> View Attendance
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="admin.editClass('${classItem.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async loadClassesForRecords() {
        try {
            // Get current user from session storage
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                this.showNotification('Please log in first', 'error');
                return;
            }
            
            const user = JSON.parse(userStr);
            if (user.role !== 'teacher') {
                this.showNotification('Access denied. Teachers only.', 'error');
                return;
            }
            
            const response = await fetch(`/api/get-classes?teacherId=${user.id}`);
            if (!response.ok) {
                throw new Error('Failed to load classes');
            }
            
            const classes = await response.json();
            const select = document.getElementById('selectedClassForRecords');
            
            select.innerHTML = '<option value="">Choose a class...</option>' +
                classes.map(classItem => 
                    `<option value="${classItem.id}">${classItem.name} (${classItem.code})</option>`
                ).join('');
        } catch (error) {
            console.error('Load classes for records error:', error);
            this.showNotification('Error loading classes', 'error');
        }
    }
    
    onClassSelectionChange(e) {
        this.selectedClassForRecords = e.target.value;
        if (this.selectedClassForRecords) {
            this.loadAttendanceRecords();
        }
    }
    
    async loadAttendanceRecords() {
        if (!this.selectedClassForRecords) return;
        
        try {
            const response = await fetch(`/api/get-class-attendance-records?classId=${this.selectedClassForRecords}`);
            if (!response.ok) {
                throw new Error('Failed to load attendance records');
            }
            
            const records = await response.json();
            this.displayAttendanceRecords(records);
        } catch (error) {
            console.error('Load attendance records error:', error);
            this.showNotification('Error loading attendance records', 'error');
        }
    }
    
    displayAttendanceRecords(records) {
        const tbody = document.getElementById('recordsTableBody');
        
        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                        No attendance records found for this class
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = records.map(record => `
            <tr>
                <td>${record.studentName || 'Unknown'}</td>
                <td>${record.studentId || 'N/A'}</td>
                <td>${record.timeIn || 'N/A'}</td>
                <td>${record.date || 'N/A'}</td>
                <td>
                    <span style="color: #10b981; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> ${record.status || 'Present'}
                    </span>
                </td>
                <td>
                    <span style="color: ${record.locationVerified ? '#10b981' : '#ef4444'}; font-weight: 600;">
                        <i class="fas fa-${record.locationVerified ? 'check-circle' : 'times-circle'}"></i>
                        ${record.locationVerified ? 'Verified' : 'Not Verified'}
                    </span>
                </td>
            </tr>
        `).join('');
    }
    
    filterRecords() {
        // Implement date filtering
        this.loadAttendanceRecords();
    }
    
    exportRecords() {
        if (!this.selectedClassForRecords) {
            this.showNotification('Please select a class first', 'warning');
            return;
        }
        
        // Implement CSV export
        this.showNotification('Export feature coming soon!', 'info');
    }
    
    viewClassAttendance(classId) {
        // Switch to attendance records view for specific class
        this.showAttendanceRecords();
        document.getElementById('selectedClassForRecords').value = classId;
        this.onClassSelectionChange({ target: { value: classId } });
    }
    
    editClass(classId) {
        // Implement class editing
        this.showNotification('Edit feature coming soon!', 'info');
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
        
        setTimeout(() => notification.classList.add('show'), 100);
        
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
        
        if (!modalOverlay || !modalTitle || !modalBody) return;
        
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        modalTitle.innerHTML = `<i class="fas fa-${icon}"></i> ${title}`;
        
        modalOverlay.style.display = 'flex';
    }
    
    closeModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    }
}

// Initialize the admin system when the page loads
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new ClassPassAdmin();
});

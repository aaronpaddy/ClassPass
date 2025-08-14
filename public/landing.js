class ClassPassLanding {
    constructor() {
        this.currentRole = null;
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Login form submission
        document.getElementById('loginFormElement').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Register form submission
        document.getElementById('registerFormElement').addEventListener('submit', (e) => this.handleRegister(e));
    }
    
    selectRole(role) {
        this.currentRole = role;
        
        // Hide role selection
        document.getElementById('roleSelection').style.display = 'none';
        
        // Show auth container
        document.getElementById('authContainer').style.display = 'block';
        
        // Show back button
        document.getElementById('backButton').style.display = 'flex';
        
        // Update form text based on role
        this.updateFormText(role);
        
        // Show appropriate fields based on role
        this.showRoleSpecificFields(role);
        
        // Animate the transition
        this.animateTransition();
    }
    
    updateFormText(role) {
        const loginRoleText = document.getElementById('loginRoleText');
        const registerRoleText = document.getElementById('registerRoleText');
        
        if (role === 'teacher') {
            loginRoleText.textContent = 'teacher account';
            registerRoleText.textContent = 'teacher';
        } else {
            loginRoleText.textContent = 'student account';
            registerRoleText.textContent = 'student';
        }
    }
    
    showRoleSpecificFields(role) {
        const teacherFields = document.getElementById('teacherFields');
        const studentFields = document.getElementById('studentFields');
        
        if (role === 'teacher') {
            teacherFields.style.display = 'block';
            studentFields.style.display = 'none';
        } else {
            teacherFields.style.display = 'none';
            studentFields.style.display = 'block';
        }
    }
    
    animateTransition() {
        const authContainer = document.getElementById('authContainer');
        authContainer.style.opacity = '0';
        authContainer.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            authContainer.style.transition = 'all 0.6s ease-out';
            authContainer.style.opacity = '1';
            authContainer.style.transform = 'translateY(0)';
        }, 100);
    }
    
    goBack() {
        // Hide auth container and back button
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('backButton').style.display = 'none';
        
        // Show role selection
        document.getElementById('roleSelection').style.display = 'block';
        
        // Reset current role
        this.currentRole = null;
        
        // Reset forms
        document.getElementById('loginFormElement').reset();
        document.getElementById('registerFormElement').reset();
        
        // Hide role-specific fields
        document.getElementById('teacherFields').style.display = 'none';
        document.getElementById('studentFields').style.display = 'none';
    }
    
    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }
    
    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    role: this.currentRole
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification('Login successful! Redirecting...', 'success');
                
                // Store user info in session
                sessionStorage.setItem('user', JSON.stringify(result.user));
                sessionStorage.setItem('role', this.currentRole);
                
                // Redirect based on role
                setTimeout(() => {
                    if (this.currentRole === 'teacher') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/attendance';
                    }
                }, 1500);
                
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const department = document.getElementById('registerDepartment').value;
        const studentId = document.getElementById('registerStudentId').value;
        
        if (!name || !email || !password) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (this.currentRole === 'teacher' && !department) {
            this.showNotification('Please enter your department', 'error');
            return;
        }
        
        if (this.currentRole === 'student' && !studentId) {
            this.showNotification('Please enter your student ID', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const userData = {
                name,
                email,
                password,
                role: this.currentRole
            };
            
            if (this.currentRole === 'teacher') {
                userData.department = department;
            } else {
                userData.studentId = studentId;
            }
            
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showNotification('Account created successfully! Please log in.', 'success');
                
                // Switch to login form
                setTimeout(() => {
                    this.showLoginForm();
                }, 1500);
                
            } else {
                const error = await response.text();
                this.showNotification(error, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Registration failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (show) {
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
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
        }, 5000);
    }
}

// Initialize the landing page
let landing;
document.addEventListener('DOMContentLoaded', () => {
    landing = new ClassPassLanding();
});

// Global functions for onclick handlers
function selectRole(role) {
    if (landing) {
        landing.selectRole(role);
    }
}

function goBack() {
    if (landing) {
        landing.goBack();
    }
}

function showLoginForm() {
    if (landing) {
        landing.showLoginForm();
    }
}

function showRegisterForm() {
    if (landing) {
        landing.showRegisterForm();
    }
}

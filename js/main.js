// Main JavaScript file for Student Education Portal

// API Configuration
const API_URL = location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://student-education-portal-backend.onrender.com";


// ===== UTILITY FUNCTIONS =====

function showAlert(message, type = 'info') {
    alert(type.toUpperCase() + ': ' + message);
}

function showLoading() {
    return '<div class="spinner"></div>';
}

function hideLoading() {
    const spinner = document.querySelector('.spinner');
    if (spinner) spinner.remove();
}

// Local Storage Helpers
function saveToken(token, userType = 'student') {
    localStorage.setItem(userType + 'Token', token);
}

function getToken(userType = 'student') {
    return localStorage.getItem(userType + 'Token');
}

function removeToken(userType = 'student') {
    localStorage.removeItem(userType + 'Token');
}

function isLoggedIn(userType = 'student') {
    return Boolean(getToken(userType));
}

// API Request Helper
function apiRequest(endpoint, options = {}, userType = 'student') {
    const token = getToken(userType);

    // merge default config + options
    const config = {
        headers: {},
        ...options
    };

    // add auth token if present
    if (token) {
        config.headers['Authorization'] = 'Bearer ' + token;
    }

    // set JSON content-type ONLY if not FormData
    if (!(config.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }

    return fetch(API_URL + endpoint, config)
        .then(response =>
            response.json().then(data => {
                if (!response.ok) {
                    throw new Error(data.message || 'Something went wrong');
                }
                return data;
            })
        );
}


// Navigation Functions
function navigateToCategory(category) {
    localStorage.setItem('selectedCategory', category);
    window.location.href = 'exam_papers.html';
}


// Authentication Functions
async function studentRegister(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        mobile: formData.get('mobile'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(API_URL + '/api/student/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            saveToken(result.token, 'student');
            localStorage.removeItem('adminToken');
            showAlert('Registration successful! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                window.location.href = 'student/dashboard.html';
            }, 2000);
        } else {
            showAlert(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function studentLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        loginId: formData.get('loginId'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(API_URL + '/api/student/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            saveToken(result.token, 'student');
            showAlert('Login successful! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                window.location.href = 'student/dashboard.html';
            }, 2000);
        } else {
            showAlert(result.message || 'Login failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'error');
    }
}

async function adminLogin(event) {
    event.preventDefault();

    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
        showAlert('Email and Password both are required', 'error');
        return;
    }

    try {
        const response = await fetch(API_URL + '/api/admin/auth/_secure_login_92x', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const result = await response.json();

        if (response.ok) {
            saveToken(result.token, 'admin');
            localStorage.removeItem('studentToken');
            showAlert('Admin login successful', 'success');
            setTimeout(() => {
                window.location.href = 'admin/dashboard.html';
            }, 1500);
        } else {
            showAlert(result.message || 'Login failed', 'error');
        }

    } catch (err) {
        console.error(err);
        showAlert('Server error', 'error');
    }
}

function logout(userType = 'student') {
    if (confirm('Are you sure you want to logout?')) {
        removeToken(userType);

        if (userType === 'admin') {
            window.location.href = 'admin_login.html';
        } else {
            window.location.href = 'index.html';
        }
    }
}

// Form Validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateMobile(mobile) {
    const re = /^[0-9]{10}$/;
    return re.test(mobile);
}

function validateForm(formData, requiredFields) {
    const errors = [];

    requiredFields.forEach(field => {
        if (!formData.get(field)) {
            errors.push(field + ' is required');
        }
    });

    // Email validation
    const email = formData.get('email');
    if (email && !validateEmail(email)) {
        errors.push('Please enter a valid email');
    }

    // Mobile validation
    const mobile = formData.get('mobile');
    if (mobile && !validateMobile(mobile)) {
        errors.push('Please enter a valid 10-digit mobile number');
    }

    // Password validation
    const password = formData.get('password');
    if (password && password.length < 6) {
        errors.push('Password must be at least 6 characters');
    }

    return errors;
}

// File Upload Helper
function handleFileUpload(fileInput, allowedTypes = ['pdf', 'doc', 'docx']) {
    const file = fileInput.files[0];

    if (!file) {
        throw new Error('No file selected');
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(fileExtension)) {
        throw new Error('Only ' + allowedTypes.join(', ') + ' files are allowed');
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size must be less than 10MB');
    }

    return file;
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Confirmation Dialog
function showConfirm(message, onConfirm, onCancel = null) {
    if (confirm(message)) {
        onConfirm();
    } else if (onCancel) {
        onCancel();
    }
}

// Initialize on page load
function init() {
    // ❌ header related kuch bhi yaha nahi

    document.querySelectorAll('.nav-menu a').forEach(link => {
        if (link.href === window.location.href) {
            link.classList.add('active');
        }
    });
}



// Search functionality
function searchItems(items, searchTerm, searchFields) {
    if (!searchTerm) return items;

    const term = searchTerm.toLowerCase();

    return items.filter(function (item) {
        return searchFields.some(function (field) {
            const value = getNestedProperty(item, field);
            return value && value.toString().toLowerCase().indexOf(term) !== -1;
        });
    });
}

function getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

// Pagination helper
function paginateItems(items, currentPage, itemsPerPage) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
        items: items.slice(startIndex, endIndex),
        totalPages: Math.ceil(items.length / itemsPerPage),
        currentPage: currentPage,
        totalItems: items.length
    };
}

// Format date helper
function formatDate(dateString) {
    if (!dateString) return 'Not set';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';

        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid date';
    }
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        return date.toISOString().split('T')[0];
    } catch (error) {
        return '';
    }
}

// Format file size helper
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if date is expired
function isDateExpired(dateString) {
    if (!dateString) return false;

    try {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return date < today;
    } catch (error) {
        return false;
    }
}

// Get job type badge class
function getJobTypeClass(jobType) {
    const classes = {
        'government': 'badge-government',
        'information': 'badge-practice',
        'apply': 'badge-final'
    };
    return classes[jobType] || 'badge-final';
}

// Get job type display text
function getJobTypeText(jobType) {
    const texts = {
        'government': 'Government',
        'information': 'Information',
        'apply': 'Apply Now'
    };
    return texts[jobType] || jobType;
}

// Redirect function
function redirect(path, delay = 1500) {
    setTimeout(() => {
        window.location.href = path;
    }, delay);
}

// API Request with FormData support
function apiRequest(endpoint, options = {}, userType = 'student') {
    const token = getToken(userType);

    const config = {
        headers: {},
        ...options
    };

    if (token) {
        config.headers['Authorization'] = 'Bearer ' + token;
    }

    if (!(config.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }

    return fetch(API_URL + endpoint, config)
        .then(async response => {
            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error('Invalid server response');
            }

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            return data;
        });
}


// ===== JOB MANAGEMENT FUNCTIONS =====


// ===== EXAM PAPER FUNCTIONS =====
async function loadExamPapers() {
    try {
        const response = await fetch(API_URL + '/api/exam-papers');

        if (!response.ok) {
            throw new Error('Failed to load exam papers');
        }

        const data = await response.json();
        return data.papers || [];
    } catch (error) {
        console.error('Error loading exam papers:', error);
        throw error;
    }
}


async function getExamPaperById(paperId) {
    try {
        const response = await fetch(API_URL + '/api/exam-papers/' + paperId);

        if (!response.ok) {
            throw new Error('Failed to fetch exam paper');
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting exam paper:', error);
        throw error;
    }
}

// ===== STUDENT JOB FUNCTIONS =====
async function loadStudentJobs() {
    try {
        const response = await fetch(API_URL + '/api/jobs');

        if (!response.ok) {
            throw new Error('Failed to load jobs');
        }

        const data = await response.json();
        return data.jobs || [];
    } catch (error) {
        console.error('Error loading student jobs:', error);
        return [];
    }
}

// ✅✅✅ FIXED FUNCTION:
function openExamPaperPDF(pdfPath, paperName = "paper") {
  if (!pdfPath) {
    alert("PDF not available");
    return;
  }

  // ✅ FORCE DOWNLOAD FIX
  const link = document.createElement('a');
  link.href = pdfPath;
  
  // Extract filename
  const fileName = paperName.replace(/[^a-z0-9]/gi, '_') + '.pdf';
  link.download = fileName;
  
  // Open in new tab for viewing
  window.open(pdfPath, '_blank');
  
  // Also trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openCategory(categorySlug) {

    const categoryMap = {
        "10th-ssc": "10th SSC",
        "10th-cbse": "10th CBSE",
        "12th-hsc-science": "12th HSC",
        "12th-cbse": "12th CBSE",
        "competitive": "Competitive",
        "govt-exams": "Competitive"
    };

    const actualCategory = categoryMap[categorySlug];

    if (!actualCategory) {
        console.error("Invalid category:", categorySlug);
        return;
    }

    window.location.href =
        `exam_papers.html?category=${encodeURIComponent(actualCategory)}`;
}

// ===== WINDOW OBJECT EXPORTS =====
window.API_URL = API_URL;

// Core functions
window.showAlert = showAlert;
window.showModal = showModal;
window.hideModal = hideModal;
window.getToken = getToken;
window.saveToken = saveToken;
window.removeToken = removeToken;
window.logout = logout;
window.formatFileSize = formatFileSize;

// Job functions
window.getJobTypeClass = getJobTypeClass;
window.getJobTypeText = getJobTypeText;

// Exam paper functions
window.loadExamPapers = loadExamPapers;
window.getExamPaperById = getExamPaperById;
window.loadStudentJobs = loadStudentJobs;

// EducationPortal object for backward compatibility
window.EducationPortal = {
    API_URL: API_URL,
    adminLogin: adminLogin,
    studentLogin: studentLogin,
    studentRegister: studentRegister,
    logout: logout,
    saveToken: saveToken,
    getToken: getToken,
    removeToken: removeToken,
    isLoggedIn: isLoggedIn,
    showAlert: showAlert,
    showModal: showModal,
    hideModal: hideModal,
    showConfirm: showConfirm,
    apiRequest: apiRequest,
    apiRequestWithFormData: apiRequestWithFormData,
    loadExamPapers: loadExamPapers,
    getExamPaperById: getExamPaperById,
    getJobTypeClass: getJobTypeClass,
    getJobTypeText: getJobTypeText,
    formatFileSize: formatFileSize,
    formatDate: formatDate,
    formatDateForInput: formatDateForInput
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('Main.js loaded successfully');
// ===== GLOBAL VARIABLES =====
let currentPapers = [];
let currentJobs = [];
let currentApplications = [];
let currentSection = 'dashboard';

const API_BASE =
    location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://student-education-portal-backend.onrender.com';

// ===== UTILITY FUNCTIONS =====

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
console.log('admin.js loaded');

function showAlert(message, type = 'info') {
    // Create a better alert system
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'}; color: white; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 3000; display: flex; align-items: center; gap: 0.5rem; min-width: 300px; max-width: 400px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    document.body.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

function showConfirm(message, onConfirm, onCancel = null) {
    const overlay = document.createElement('div');

    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    overlay.innerHTML = `
        <div style="background:white; padding:20px; border-radius:10px; width:90%; max-width:400px;">
            <h3 style="margin-bottom:10px;">Confirm</h3>
            <p style="margin-bottom:20px;">${message}</p>
            <div style="text-align:right;">
                <button id="cancelBtn">Cancel</button>
                <button id="okBtn">OK</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('okBtn').onclick = () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    };

    document.getElementById('cancelBtn').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
}

function getToken(userType = 'admin') {
    return localStorage.getItem(userType + 'Token');
}

function removeToken(userType = 'admin') {
    localStorage.removeItem(userType + 'Token');
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// ===== MODAL FUNCTIONS =====
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

        // Reset forms
        const forms = {
            'addPaperModal': ['addPaperForm', 'pdfFileInfo', 'No file selected'],
            'editPaperModal': ['editPaperForm', 'editPdfFileInfo', 'Current file will be kept'],
            'addJobModal': ['addJobForm', 'jobPdfFileInfo', 'No file selected'],
            'editJobModal': ['editJobForm', 'editJobPdfFileInfo', 'Current file will be kept']
        };

        if (forms[modalId]) {
            const [formId, fileInfoId, defaultText] = forms[modalId];
            const form = document.getElementById(formId);
            if (form) form.reset();
            const fileInfo = document.getElementById(fileInfoId);
            if (fileInfo) {
                fileInfo.textContent = defaultText;
                fileInfo.classList.remove('has-file');
            }
        }
    }
}

// ===== LOGOUT =====
function logoutAdmin() {
    showConfirm('Are you sure you want to logout?', function () {
        removeToken('admin');
        window.location.href = '../admin_login.html';
    });
}

// ===== SECTION NAVIGATION =====
function showSection(section) {


    currentSection = section;

    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(function (sectionElement) {
        sectionElement.classList.remove('active');
        sectionElement.style.display = 'none';
    });

    // Show target section
    const targetSectionId = section + '-section';
    const targetSection = document.getElementById(targetSectionId);

    if (!targetSection) return;

    targetSection.classList.add('active');
    targetSection.style.display = 'block';

    // Update sidebar active state
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');

    // Remove active class from all links
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to clicked link
    sidebarLinks.forEach(link => {
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes("showSection('" + section + "')")) {
            link.classList.add('active');
        }
    });

    // Load section data
    switch (section) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'jobs':
            loadJobs();
            break;
        case 'papers':
            loadExamPapers();
            break;
        case 'applications':
            loadApplications();
            break;
    }

    // Close mobile menu if open
    if (window.innerWidth <= 992) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboardStats() {
    try {
        const token = getToken('admin');
        if (!token) {
            showAlert('Please login again', 'error');
            return;
        }

        const response = await fetch(API_BASE + '/api/admin/auth/dashboard', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load dashboard stats');
        }

        const data = await response.json();

        if (!data.success || !data.stats) {
            throw new Error('Invalid stats response');
        }

        const {
            totalPapers = 0,
            totalJobs = 0,
            totalApplications = 0
        } = data.stats;

        // Students = unique applicants (simple assumption)
        const totalStudents = totalApplications;

        animateCounter(document.getElementById('totalPapers'), totalPapers);
        animateCounter(document.getElementById('totalJobs'), totalJobs);
        animateCounter(document.getElementById('totalApplications'), totalApplications);
        animateCounter(document.getElementById('totalStudents'), totalStudents);

    } catch (error) {
        console.error(error);
        showAlert('Failed to load dashboard stats', 'error');

        // fallback
        ['totalPapers', 'totalJobs', 'totalApplications', 'totalStudents']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
    }
}


// Animate counter from 0 to target value
function animateCounter(element, target) {
    if (!element) return;

    const current = parseInt(element.textContent) || 0;
    if (current === target) return;

    const duration = 1000;
    const startTime = Date.now();
    const increment = target > current ? 1 : -1;

    function updateCounter() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.round(current + (target - current) * easeOutQuart);

        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target;
        }
    }

    updateCounter();
}

// ===== RELOAD ALL DATA =====
async function reloadAllData() {
    try {
        showAlert('Reloading all data...', 'info');

        currentPapers = [];
        currentJobs = [];
        currentApplications = [];

        await Promise.all([
            loadExamPapers(),
            loadJobs(),
            loadApplications(),
            loadDashboardStats()
        ]);

        showAlert('All data reloaded successfully!', 'success');
    } catch (error) {
        showAlert('Failed to reload data', 'error');
    }
}

// ===== EXAM PAPER FUNCTIONS =====
async function loadExamPapers() {
    try {
        const papersList = document.getElementById('papersList');
        const categoryEl = document.getElementById('filterCategory');
        const yearEl = document.getElementById('filterYear');
        const subjectEl = document.getElementById('filterSubject');
        const paperTypeEl = document.getElementById('filterPaperType');

        const category = categoryEl ? categoryEl.value : '';
        const year = yearEl ? yearEl.value : '';
        const subject = subjectEl ? subjectEl.value : '';
        const paperType = paperTypeEl ? paperTypeEl.value : '';

        let url = API_BASE + '/api/exam-papers?';

        if (category) url += `category=${category}&`;
        if (year) url += `year=${year}&`;
        if (subject) url += `subject=${subject}&`;
        if (paperType) url += `paperType=${paperType}&`;

        if (!papersList) return;

        papersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading exam papers...</p></div>';

        const token = getToken('admin');
        if (!token) {
            papersList.innerHTML = '<div class="error-state"><p>Not authenticated. Please login again.</p></div>';
            showAlert('Please login again', 'error');
            return;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load exam papers: ' + response.status);
        }

        const data = await response.json();
        currentPapers = data.papers || [];

        if (currentPapers.length > 0) {
            renderPapersTable(currentPapers);
        } else {
            showEmptyPapersState();
        }
    } catch (error) {
        showErrorState('papersList', 'Failed to load exam papers. Please try again.', loadExamPapers);
    }
}

function showEmptyPapersState() {
    const papersList = document.getElementById('papersList');
    papersList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <p>No exam papers found. Add your first paper!</p>
            <button class="btn btn-primary" onclick="showModal('addPaperModal')" style="margin-top: 20px;">
                <i class="fas fa-plus"></i> Add First Paper
            </button>
        </div>
    `;
}

function showErrorState(elementId, message, retryFunction) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="${retryFunction.name}()" style="margin-top: 20px;">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

function renderPapersTable(papers) {
    const papersList = document.getElementById('papersList');

    if (!papers || papers.length === 0) {
        showEmptyPapersState();
        return;
    }

    let html = `
        <div class="papers-table-container">
            <table class="papers-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Year</th>
                        <th>Type</th>
                        <th>File Name</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    papers.forEach(function (paper) {
        const fileName = paper.pdfPath || 'paper.pdf';
        const badgeClass = paper.paperType === 'Final Exam Paper' ? 'badge-final' : 'badge-practice';
        const pdfUrl = paper.pdfPath
            ? `${API_BASE}/api/exam-papers/download/pdf/${paper.pdfPath}`
            : '#';


        html += `
            <tr>
                <td><strong>${paper.category || 'N/A'}</strong></td>
                <td>${paper['class'] || '-'}</td>
                <td>${paper.subject || '-'}</td>
                <td>${paper.year || '-'}</td>
                <td><span class="badge ${badgeClass}">${paper.paperType || 'N/A'}</span></td>
                <td title="${fileName}">${fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName}</td>
                <td>
                    <div class="table-actions">
                        <a href="${pdfUrl}" target="_blank" class="btn btn-view" title="View PDF">
                            <i class="fas fa-eye"></i> View
                        </a>
                        <button class="btn btn-edit" onclick="openEditPaper('${paper._id}')" title="Edit">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-delete" onclick="deletePaperPrompt('${paper._id}', '${paper.subject}')" title="Delete">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="padding: 1rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <div style="color: #64748b; font-size: 0.875rem;">
                    Showing ${papers.length} paper(s)
                </div>
            </div>
        </div>
    `;

    papersList.innerHTML = html;
}

async function openEditPaper(paperId) {
    try {
        const token = getToken('admin');
        const response = await fetch(API_BASE + '/api/exam-papers/' + paperId, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        const paper = data.paper;

        document.getElementById('editPaperId').value = paper._id;
        document.getElementById('editPaperCategory').value = paper.category || '';
        document.getElementById('editPaperClass').value = paper['class'] || '';
        document.getElementById('editPaperSubject').value = paper.subject || '';
        document.getElementById('editPaperYear').value = paper.year || '';
        document.getElementById('editPaperType').value = paper.paperType || '';

        if (paper.pdfPath) {
            const fileName = paper.pdfPath.split('/').pop();
            const pdfUrl = `${API_BASE}/api/exam-papers/download/pdf/${paper.pdfPath}`;
            const fileInfo = document.getElementById('editPdfFileInfo');
            fileInfo.innerHTML = `Current file: <a href="${pdfUrl}" target="_blank">${fileName}</a>`;
            fileInfo.classList.add('has-file');
        }

        showModal('editPaperModal');
    } catch (error) {
        showAlert('Failed to load paper details', 'error');
    }
}

async function submitAddPaper(e) {
    e.preventDefault();

    const category = document.getElementById('paperCategory').value.trim();
    const paperClass = document.getElementById('paperClass').value.trim();
    const subject = document.getElementById('paperSubject').value.trim();
    const year = document.getElementById('paperYear').value.trim();
    const paperType = document.getElementById('paperType').value;

    // ✅ FIRST declare pdfFile
    const pdfFile = document.getElementById('paperPdf').files[0];

    // ✅ derive filename AFTER pdfFile exists
    const fileName = pdfFile ? pdfFile.name : '';

    if (!category || !paperClass || !subject || !year || !paperType) {
        showAlert('All fields are required', 'error');
        return;
    }

    if (!pdfFile) {
        showAlert('PDF file is required', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('category', category);
    formData.append('class', paperClass);
    formData.append('subject', subject);
    formData.append('fileName', fileName);
    formData.append('year', year);
    formData.append('paperType', paperType);
    formData.append('pdf', pdfFile);

    try {
        const token = getToken('admin');

        const response = await fetch(API_BASE + '/api/exam-papers', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Exam paper added successfully!', 'success');
            hideModal('addPaperModal');
            loadExamPapers();
            loadDashboardStats();
        } else {
            showAlert(data.message || 'Failed to add paper', 'error');
        }

    } catch (error) {
        showAlert('Failed to add paper', 'error');
    }
}

async function submitEditPaper(e) {
    e.preventDefault();

    const paperId = document.getElementById('editPaperId').value;
    const category = document.getElementById('editPaperCategory').value.trim();
    const paperClass = document.getElementById('editPaperClass').value.trim();
    const subject = document.getElementById('editPaperSubject').value.trim();
    const year = document.getElementById('editPaperYear').value.trim();
    const paperType = document.getElementById('editPaperType').value;
    const pdfFile = document.getElementById('editPaperPdf').files[0];

    const formData = new FormData();
    formData.append('category', category);
    formData.append('class', paperClass);
    formData.append('subject', subject);
    formData.append('year', year);
    formData.append('paperType', paperType);

    if (pdfFile) {
        formData.append('pdf', pdfFile);
    }

    try {
        const token = getToken('admin');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        submitBtn.disabled = true;

        const response = await fetch(API_BASE + '/api/exam-papers/' + paperId, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await response.json();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (data.success) {
            showAlert('Exam paper updated successfully!', 'success');
            hideModal('editPaperModal');
            await Promise.all([
                loadExamPapers(),
                loadDashboardStats()
            ]);
        } else {
            showAlert(data.message || 'Failed to update paper', 'error');
        }

    } catch (error) {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Paper';
        submitBtn.disabled = false;
        showAlert('Failed to update paper: ' + error.message, 'error');
    }
}

function deletePaperPrompt(paperId, paperTitle) {
    showConfirm(
        `Are you sure you want to delete "${paperTitle}" paper? This action cannot be undone.`,
        async function () {
            try {
                const token = getToken('admin');
                const response = await fetch(API_BASE + '/api/exam-papers/' + paperId, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('Paper deleted successfully!', 'success');
                    await Promise.all([
                        loadExamPapers(),
                        loadDashboardStats()
                    ]);
                } else {
                    showAlert('Failed to delete paper', 'error');
                }
            } catch (error) {
                showAlert('Failed to delete paper', 'error');
            }
        }
    );
}

// ===== JOB FUNCTIONS js =====
async function loadJobs() {
    try {
        const jobsList = document.getElementById('jobsList');
        if (!jobsList) return;

        jobsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading jobs...</p></div>';

        const token = getToken('admin');
        if (!token) {
            jobsList.innerHTML = '<div class="error-state"><p>Not authenticated. Please login again.</p></div>';
            return;
        }

        const response = await fetch(API_BASE + '/api/jobs', {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load jobs: ' + response.status);
        }

        const data = await response.json();
        currentJobs = data.jobs || [];

        if (currentJobs.length > 0) {
            renderJobsTable(currentJobs);
        } else {
            showEmptyJobsState();
        }
    } catch (error) {
        showErrorState('jobsList', 'Failed to load jobs. Please try again.', loadJobs);
    }
}

function showEmptyJobsState() {
    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-briefcase"></i>
            <p>No jobs found. Add your first job!</p>
            <button class="btn btn-primary" onclick="showModal('addJobModal')" style="margin-top: 20px;">
                <i class="fas fa-plus"></i> Add First Job
            </button>
        </div>
    `;
}

function renderJobsTable(jobs) {
    const jobsList = document.getElementById('jobsList');

    if (!jobs || jobs.length === 0) {
        showEmptyJobsState();
        return;
    }

    let html = `
        <div class="papers-table-container">
            <table class="papers-table">
                <thead>
                    <tr>
                        <th>Job Title</th>
                        <th>Type</th>
                        <th>Qualification</th>
                        <th>Company/Dept</th>
                        <th>Last Date</th>
                        <th>PDF</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    jobs.forEach(function (job) {
        const jobTypeText = getJobTypeText(job.jobType);
        const jobTypeClass = getJobTypeClass(job.jobType);
        const lastDate = job.lastDate ? new Date(job.lastDate).toLocaleDateString('en-IN') : '-';
        const pdfUrl = job.jobPdf || '#';


        html += `
            <tr>
                <td><strong>${job.jobTitle || 'N/A'}</strong></td>
                <td><span class="badge ${jobTypeClass}">${jobTypeText}</span></td>
                <td>${job.qualification || '-'}</td>
                <td>${job.companyName || job.department || '-'}</td>
                <td>${lastDate}</td>
                <td>
                    ${job.jobPdf ?
                `<a href="${pdfUrl}" target="_blank" class="btn btn-view" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                            <i class="fas fa-download"></i> PDF
                        </a>` :
                'No PDF'
            }
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-edit" onclick="openEditJob('${job._id}')" title="Edit">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-delete" onclick="deleteJobPrompt('${job._id}', '${job.jobTitle}')" title="Delete">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="padding: 1rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <div style="color: #64748b; font-size: 0.875rem;">
                    Showing ${jobs.length} job(s)
                </div>
            </div>
        </div>
    `;

    jobsList.innerHTML = html;
}

function getJobTypeClass(jobType) {
    const classes = {
        'government': 'badge-government',
        'information': 'badge-information',
        'apply': 'badge-apply'
    };
    return classes[jobType] || 'badge-final';
}

function getJobTypeText(jobType) {
    const texts = {
        'government': 'Government',
        'information': 'Information',
        'apply': 'Apply Now'
    };
    return texts[jobType] || jobType;
}

async function openEditJob(jobId) {
    try {
        const token = getToken('admin');
        const response = await fetch(API_BASE + '/api/jobs/' + jobId, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        const job = data.job;

        document.getElementById('editJobId').value = job._id;
        document.getElementById('editJobTitle').value = job.jobTitle || '';
        document.getElementById('editJobType').value = job.jobType || '';
        document.getElementById('editQualification').value = job.qualification || '';
        document.getElementById('editCompanyName').value = job.companyName || job.department || '';
        document.getElementById('editJobDescription').value = job.jobDescription || '';

        if (job.lastDate) {
            const date = new Date(job.lastDate);
            document.getElementById('editLastDate').value = date.toISOString().split('T')[0];
        }

        if (job.jobPdf) {
            const fileName = job.jobPdf.split('/').pop();
            const pdfUrl = job.jobPdf;
            const fileInfo = document.getElementById('editJobPdfFileInfo');
            fileInfo.innerHTML = `Current file: <a href="${pdfUrl}" target="_blank">${fileName}</a>`;
            fileInfo.classList.add('has-file');
        }
        if (!fileName) {
            showAlert('File name is required', 'error');
            return;
        }
        showModal('editJobModal');
    } catch (error) {
        showAlert('Failed to load job details', 'error');
    }
}

async function submitAddJob(e) {
    e.preventDefault();

    const jobTitle = document.getElementById('jobTitle').value.trim();
    const jobType = document.getElementById('jobType').value;
    const qualification = document.getElementById('qualification').value.trim();
    const companyName = document.getElementById('companyName').value.trim();
    const lastDate = document.getElementById('lastDate').value;
    const jobDescription = document.getElementById('jobDescription').value.trim();
    const jobPdf = document.getElementById('jobPdf').files[0];

    if (!jobTitle || !jobType || !qualification) {
        showAlert('Job Title, Type and Qualification are required', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('jobTitle', jobTitle);
    formData.append('jobType', jobType);
    formData.append('qualification', qualification);
    formData.append('companyName', companyName);
    formData.append('jobDescription', jobDescription);

    if (lastDate) {
        formData.append('lastDate', lastDate);
    }

    if (jobPdf) {
        formData.append('jobPdf', jobPdf);
    }

    try {
        const token = getToken('admin');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitBtn.disabled = true;

        const response = await fetch(API_BASE + '/api/jobs', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await response.json();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (data.success) {
            showAlert('Job added successfully!', 'success');
            hideModal('addJobModal');
            await Promise.all([
                loadJobs(),
                loadDashboardStats()
            ]);
        } else {
            showAlert(data.message || 'Failed to add job', 'error');
        }

    } catch (error) {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Job';
        submitBtn.disabled = false;
        showAlert('Failed to add job: ' + error.message, 'error');
    }
}

async function submitEditJob(e) {
    e.preventDefault();

    const jobId = document.getElementById('editJobId').value;
    const jobTitle = document.getElementById('editJobTitle').value.trim();
    const jobType = document.getElementById('editJobType').value;
    const qualification = document.getElementById('editQualification').value.trim();
    const companyName = document.getElementById('editCompanyName').value.trim();
    const lastDate = document.getElementById('editLastDate').value;
    const jobDescription = document.getElementById('editJobDescription').value.trim();
    const jobPdf = document.getElementById('editJobPdf').files[0];

    const formData = new FormData();
    formData.append('jobTitle', jobTitle);
    formData.append('jobType', jobType);
    formData.append('qualification', qualification);
    formData.append('companyName', companyName);
    formData.append('jobDescription', jobDescription);

    if (lastDate) {
        formData.append('lastDate', lastDate);
    }

    if (jobPdf) {
        formData.append('jobPdf', jobPdf);
    }

    try {
        const token = getToken('admin');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        submitBtn.disabled = true;

        const response = await fetch(API_BASE + '/api/jobs/' + jobId, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await response.json();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (data.success) {
            showAlert('Job updated successfully!', 'success');
            hideModal('editJobModal');
            await Promise.all([
                loadJobs(),
                loadDashboardStats()
            ]);
        } else {
            showAlert(data.message || 'Failed to update job', 'error');
        }

    } catch (error) {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Job';
        submitBtn.disabled = false;
        showAlert('Failed to update job: ' + error.message, 'error');
    }
}

function deleteJobPrompt(jobId, jobTitle) {
    showConfirm(
        `Are you sure you want to delete "${jobTitle}" job? This action cannot be undone.`,
        async function () {
            try {
                const token = getToken('admin');
                const response = await fetch(API_BASE + '/api/jobs/' + jobId, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('Job deleted successfully!', 'success');
                    await Promise.all([
                        loadJobs(),
                        loadDashboardStats()
                    ]);
                } else {
                    showAlert('Failed to delete job', 'error');
                }
            } catch (error) {
                showAlert('Failed to delete job', 'error');
            }
        }
    );
}

// ===== FILTER FUNCTIONS =====
function applyFilters() {
    loadExamPapers();
}

function clearFilters() {
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterYear').value = '';
    document.getElementById('filterSubject').value = '';
    document.getElementById('filterPaperType').value = '';
    loadExamPapers();
}

function applyJobFilters() {
    loadJobs();
}

function clearJobFilters() {
    document.getElementById('filterJobType').value = '';
    document.getElementById('filterLastDate').value = '';
    loadJobs();
}

function searchPapers() {
    const searchTerm = document.getElementById('paperSearch').value.toLowerCase();
    if (!searchTerm) {
        renderPapersTable(currentPapers);
        return;
    }

    const filteredPapers = currentPapers.filter(function (paper) {
        return (
            (paper.category && paper.category.toLowerCase().includes(searchTerm)) ||
            (paper.class && paper.class.toLowerCase().includes(searchTerm)) ||
            (paper.subject && paper.subject.toLowerCase().includes(searchTerm)) ||
            (paper.year && paper.year.toLowerCase().includes(searchTerm)) ||
            (paper.paperType && paper.paperType.toLowerCase().includes(searchTerm))
        );
    });

    renderPapersTable(filteredPapers);
}

function searchJobs() {
    const searchTerm = document.getElementById('jobSearch').value.toLowerCase();
    if (!searchTerm) {
        renderJobsTable(currentJobs);
        return;
    }

    const filteredJobs = currentJobs.filter(function (job) {
        return (
            (job.jobTitle && job.jobTitle.toLowerCase().includes(searchTerm)) ||
            (job.jobType && job.jobType.toLowerCase().includes(searchTerm)) ||
            (job.qualification && job.qualification.toLowerCase().includes(searchTerm)) ||
            (job.companyName && job.companyName.toLowerCase().includes(searchTerm))
        );
    });

    renderJobsTable(filteredJobs);
}

function showEmptyApplicationsState() {
    const applicationsList = document.getElementById('applicationsList');
    applicationsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-users"></i>
            <p>No job applications found yet.</p>
            <p style="color: #64748b; margin-top: 10px; font-size: 0.875rem;">
                Applications will appear here when students apply for jobs
            </p>
        </div>
    `;
}

function renderApplicationsTable(applications) {
    const applicationsList = document.getElementById('applicationsList');

    if (!applications || applications.length === 0) {
        showEmptyApplicationsState();
        return;
    }

    let html = `
        <div class="papers-table-container">
            <table class="applications-table">
                <thead>
                    <tr>
                        <th>Applicant Name</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>Job Title</th>
                        <th>Applied Date</th>
                        <th>Resume</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    applications.forEach(function (application) {
        const applicantName = application.applicantName || 'N/A';
        const email = application.email || 'N/A';
        const mobile = application.mobile || 'N/A';
        const jobTitle = (application.jobId && application.jobId.jobTitle)
            ? application.jobId.jobTitle
            : 'Job Not Found';

        const resumeUrl = application.resume ? API_BASE + application.resume : '#';
        const appliedDate = application.appliedAt ?
            new Date(application.appliedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }) : 'N/A';

        const status = application.status || 'pending';
        const statusClass = 'badge-' + status;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);

        html += `
            <tr>
                <td><strong>${applicantName}</strong></td>
                <td>${email}</td>
                <td>${mobile}</td>
                <td>${jobTitle}</td>
                <td>${appliedDate}</td>
                <td>
                    ${application.resume ?
                `<div class="table-actions" style="justify-content: flex-start;">
                            <a href="${resumeUrl}" target="_blank" class="btn btn-view" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 5px;">
                                <i class="fas fa-eye"></i> View
                            </a>
                            <a href="${resumeUrl}" download class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>` :
                '<span class="badge badge-pending">No Resume</span>'
            }
                </td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="table-actions" style="flex-wrap: nowrap;">
                        <button class="btn btn-delete" onclick="deleteApplicationPrompt('${application._id}', '${applicantName}')" title="Delete" style="margin-left: 5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="padding: 1rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <div style="color: #64748b; font-size: 0.875rem;">
                    Showing ${applications.length} application(s)
                </div>
            </div>
        </div>
    `;

    applicationsList.innerHTML = html;
}

async function loadJobFilterOptions() {
    try {
        const token = getToken('admin');
        if (!token) return;

        const response = await fetch(API_BASE + '/api/jobs', {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const jobs = data.jobs || [];

            const filterSelect = document.getElementById('filterApplicationJob');
            if (filterSelect) {
                while (filterSelect.options.length > 1) {
                    filterSelect.remove(1);
                }

                jobs.forEach(job => {
                    const option = document.createElement('option');
                    option.value = job._id;
                    option.textContent = job.jobTitle;
                    filterSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading jobs for filter:', error);
    }
}


function deleteApplicationPrompt(applicationId, applicantName) {
    showConfirm(
        `Are you sure you want to delete application from "${applicantName}"? This action cannot be undone.`,
        async function () {
            try {
                const token = getToken('admin');
                const response = await fetch(`${API_BASE}/api/jobs/applications/${applicationId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('Application deleted successfully!', 'success');
                    await Promise.all([
                        loadApplications(),
                        loadDashboardStats()
                    ]);
                } else {
                    showAlert('Failed to delete application', 'error');
                }
            } catch (error) {
                showAlert('Failed to delete application', 'error');
            }
        }
    );
}

// ===== APPLICATION FILTER FUNCTIONS =====
function applyApplicationFilters() {
    const jobId = document.getElementById('filterApplicationJob').value;
    const status = document.getElementById('filterApplicationStatus').value;
    const fromDate = document.getElementById('filterApplicationFromDate').value;
    const toDate = document.getElementById('filterApplicationToDate').value;

    let filtered = currentApplications;

    if (jobId) {
        filtered = filtered.filter(app =>
            app.jobId && app.jobId._id === jobId
        );
    }

    if (status) {
        filtered = filtered.filter(app =>
            app.status === status
        );
    }

    if (fromDate) {
        const from = new Date(fromDate);
        filtered = filtered.filter(app => {
            const appDate = new Date(app.appliedAt);
            return appDate >= from;
        });
    }

    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(app => {
            const appDate = new Date(app.appliedAt);
            return appDate <= to;
        });
    }

    renderApplicationsTable(filtered);
}

function filterApplications() {
    applyApplicationFilters();
}

function clearApplicationFilters() {
    document.getElementById('filterApplicationJob').value = '';
    document.getElementById('filterApplicationStatus').value = '';
    document.getElementById('filterApplicationFromDate').value = '';
    document.getElementById('filterApplicationToDate').value = '';

    renderApplicationsTable(currentApplications);
}

function searchApplications() {
    const searchTerm = document.getElementById('applicationSearch').value.toLowerCase();
    if (!searchTerm) {
        renderApplicationsTable(currentApplications);
        return;
    }

    const filteredApplications = currentApplications.filter(function (application) {
        return (
            (application.applicantName && application.applicantName.toLowerCase().includes(searchTerm)) ||
            (application.email && application.email.toLowerCase().includes(searchTerm)) ||
            (application.mobile && application.mobile.includes(searchTerm)) ||
            (application.jobId && application.jobId.jobTitle &&
                application.jobId.jobTitle.toLowerCase().includes(searchTerm))
        );
    });

    renderApplicationsTable(filteredApplications);
}

async function loadApplications() {
    try {
        const token = getToken('admin');
        if (!token) return;

        const res = await fetch(API_BASE + '/api/jobs/applications/all', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        const data = await res.json();

        if (!data.success) {
            showEmptyApplicationsState();
            return;
        }

        currentApplications = data.applications || [];
        renderApplicationsTable(currentApplications);

    } catch (error) {
        console.error('Load applications error:', error);
        showEmptyApplicationsState();
    }
}


// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    const adminToken = getToken('admin');

    // Only block if token is missing
    if (!adminToken) {
        window.location.href = '../admin_login.html';
        return;
    }

    // ❌ DO NOT auto logout if API fails
    console.log('Admin token found, dashboard allowed');


    const editPaperPdfInput = document.getElementById('editPaperPdf');
    if (editPaperPdfInput) {
        editPaperPdfInput.addEventListener('change', function () {
            const fileInfo = document.getElementById('editPdfFileInfo');
            if (this.files.length > 0) {
                const file = this.files[0];
                fileInfo.textContent = 'New file: ' + file.name + ' (' + formatFileSize(file.size) + ')';
                fileInfo.classList.add('has-file');
            } else {
                fileInfo.textContent = 'Current file will be kept';
                fileInfo.classList.remove('has-file');
            }
        });
    }

    const jobPdfInput = document.getElementById('jobPdf');
    if (jobPdfInput) {
        jobPdfInput.addEventListener('change', function () {
            const fileInfo = document.getElementById('jobPdfFileInfo');
            if (this.files.length > 0) {
                const file = this.files[0];
                fileInfo.textContent = 'Selected: ' + file.name + ' (' + formatFileSize(file.size) + ')';
                fileInfo.classList.add('has-file');
            } else {
                fileInfo.textContent = 'No file selected';
                fileInfo.classList.remove('has-file');
            }
        });
    }

    const editJobPdfInput = document.getElementById('editJobPdf');
    if (editJobPdfInput) {
        editJobPdfInput.addEventListener('change', function () {
            const fileInfo = document.getElementById('editJobPdfFileInfo');
            if (this.files.length > 0) {
                const file = this.files[0];
                fileInfo.textContent = 'New file: ' + file.name + ' (' + formatFileSize(file.size) + ')';
                fileInfo.classList.add('has-file');
            } else {
                fileInfo.textContent = 'Current file will be kept';
                fileInfo.classList.remove('has-file');
            }
        });
    }

    // Setup form event listeners
    const addPaperForm = document.getElementById('addPaperForm');
    if (addPaperForm) {
        addPaperForm.addEventListener('submit', submitAddPaper);
    }

    const editPaperForm = document.getElementById('editPaperForm');
    if (editPaperForm) {
        editPaperForm.addEventListener('submit', submitEditPaper);
    }

    const addJobForm = document.getElementById('addJobForm');
    if (addJobForm) {
        addJobForm.addEventListener('submit', submitAddJob);
    }

    const editJobForm = document.getElementById('editJobForm');
    if (editJobForm) {
        editJobForm.addEventListener('submit', submitEditJob);
    }

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });

    // Setup scroll indicator
    const scrollIndicator = document.getElementById('scrollIndicator');
    if (scrollIndicator) {
        // Hide initially
        scrollIndicator.style.display = 'none';

        window.addEventListener('scroll', function () {
            if (window.scrollY > 100) {
                scrollIndicator.style.display = 'flex';
            } else {
                scrollIndicator.style.display = 'none';
            }
        });

        scrollIndicator.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Initialize dashboard
    setTimeout(() => {
        showSection('dashboard');
    }, 300);
});

// Add refresh button dynamically
function addRefreshButtonToDashboard() {
    const dashboardActions = document.querySelector('#dashboard-section .dashboard-actions .action-buttons');
    if (dashboardActions) {
        const existingRefreshBtn = dashboardActions.querySelector('.refresh-all-btn');
        if (!existingRefreshBtn) {
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'btn btn-outline refresh-all-btn';
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh All';
            refreshBtn.onclick = reloadAllData;
            dashboardActions.appendChild(refreshBtn);
        }
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== GLOBAL FUNCTIONS =====
window.showSection = showSection;
window.toggleMobileMenu = toggleMobileMenu;
window.showModal = showModal;
window.hideModal = hideModal;
window.loadExamPapers = loadExamPapers;
window.loadJobs = loadJobs;
window.loadApplications = loadApplications;
window.loadDashboardStats = loadDashboardStats;
window.reloadAllData = reloadAllData;
window.logoutAdmin = logoutAdmin;
window.searchPapers = searchPapers;
window.searchJobs = searchJobs;
window.searchApplications = searchApplications;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.applyJobFilters = applyJobFilters;
window.clearJobFilters = clearJobFilters;
window.applyApplicationFilters = applyApplicationFilters;
window.clearApplicationFilters = clearApplicationFilters;
window.filterApplications = filterApplications;
window.scrollToTop = scrollToTop;
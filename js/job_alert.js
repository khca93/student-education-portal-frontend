const API_URL =
  location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://student-education-portal-backend.onrender.com';

let ALL_JOBS = [];

/* ===============================
   INITIAL LOAD
================================ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadJobs);
} else {
  loadJobs();
}

async function loadJobs() {
  try {
    const res = await fetch(API_URL + '/api/jobs');
    const data = await res.json();

    if (data.success && Array.isArray(data.jobs)) {
      ALL_JOBS = data.jobs;
      filterJobs('government');
    } else {
      ALL_JOBS = [];
    }
  } catch (err) {
    console.error('Load jobs error:', err);
  }
}

/* ===============================
   FILTER JOBS
================================ */

function filterJobs(type) {

  document.querySelectorAll('.filter-card')
    .forEach(card => card.classList.remove('active'));

  const card = document.getElementById('card-' + type);
  if (card) {
    card.classList.add('active');
  }

  const jobs = ALL_JOBS.filter(j => {
    if (!j.jobType) return false;

    const dbType = j.jobType.toLowerCase().trim();

    if (type === 'government' && dbType.includes('government')) return true;
    if (type === 'information' && (dbType.includes('information') || dbType.includes('private'))) return true;
    if (type === 'apply' && (dbType.includes('apply') || dbType.includes('intern'))) return true;

    return false;
  });

  renderJobs(jobs, type);
}



/* ===============================
   RENDER JOB LIST
================================ */

function renderJobs(jobs, type) {
  const list = document.getElementById('jobList');

  if (!jobs.length) {
    list.innerHTML = `<div class="job-card"><p>No jobs available.</p></div>`;
    return;
  }

  list.innerHTML = jobs.map(job => jobCard(job, type)).join('');
}

/* ===============================
   JOB CARD TEMPLATE
================================ */

function jobCard(job, type) {

  // Safe Description (XSS Protection)
  const safeDescription = job.jobDescription
    ? job.jobDescription.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : 'No description available.';

  /* ======================
     GOVERNMENT JOB
  =======================*/
  if (type === 'government') {
    return `
      <div class="job-card modern-card">

        <h3 class="job-title-main">${job.jobTitle || '-'}</h3>

        <div class="job-meta">
          <div><span>Qualification:</span> ${job.qualification || '-'}</div>
          <div><span>Last Date:</span> 
            ${job.lastDate ? formatDate(job.lastDate) : 'Not Specified'}
          </div>
        </div>

        <div class="job-summary">
          <i class="fa-solid fa-file-pdf"></i>
          Official Notification PDF:
        </div>

        ${
          job.jobPdf
            ? `<a href="${job.jobPdf}" class="btn btn-outline" target="_blank">
                View / Download PDF
              </a>`
            : `<p><i>No PDF available</i></p>`
        }

      </div>
    `;
  }

  /* ======================
     PRIVATE / INFORMATION
  =======================*/
  if (type === 'information') {
    return `
      <div class="job-card modern-card">

        <h3 class="job-title-main">${job.jobTitle || '-'}</h3>

        <div class="job-meta">
          <div><span>Qualification:</span> ${job.qualification || '-'}</div>
          <div><span>Company / Department:</span> ${job.companyName || '-'}</div>
          <div><span>Last Date:</span> 
            ${job.lastDate ? formatDate(job.lastDate) : 'Not Specified'}
          </div>
        </div>

        <div class="job-summary">
          <i class="fa-solid fa-circle-info"></i>
          Important job details are given below:
        </div>

        <div class="job-description">
          ${safeDescription}
        </div>

      </div>
    `;
  }

  /* ======================
     INTERNSHIP / APPLY
  =======================*/
  return `
    <div class="job-card modern-card">

      <h3 class="job-title-main">${job.jobTitle || '-'}</h3>

      <div class="job-meta">
        <div><span>Qualification:</span> ${job.qualification || '-'}</div>
        <div><span>Company / Department:</span> ${job.companyName || '-'}</div>
        <div><span>Last Date:</span> 
          ${job.lastDate ? formatDate(job.lastDate) : 'Not Specified'}
        </div>
      </div>

      <div class="job-summary">
        <i class="fa-solid fa-circle-info"></i>
        Please read the full job description before applying.
      </div>

      <div class="job-description">
        ${safeDescription}
      </div>

      <div class="job-card-footer">
        <button
          type="button"
          class="btn btn-primary"
          onclick="openApplyModal('${job._id}')">
          Apply Now
        </button>
      </div>

    </div>
  `;
}

/* ===============================
   APPLY MODAL
================================ */

function openApplyModal(id) {
  document.getElementById('applyJobId').value = id;
  document.getElementById('applyModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeApplyModal() {
  document.getElementById('applyModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

/* ===============================
   APPLY FORM SUBMIT
================================ */

const form = document.getElementById('applyForm');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('jobId', form.jobId.value);
    formData.append('applicantName', form.applicantName.value);
    formData.append('qualification', form.qualification.value);
    formData.append('email', form.email.value);
    formData.append('mobile', form.mobile.value);

    const resumeFile = form.resume.files[0];
    if (resumeFile) {
      formData.append('resume', resumeFile);  // ⚠️ MUST MATCH multer field name
    }

    try {
      const res = await fetch(API_URL + '/api/jobs/apply', {
        method: 'POST',
        body: formData
      });

      if (res.status === 409) {
        alert('You have already applied for this job.');
        return;
      }

      const data = await res.json();

      if (!data.success) {
        alert('Failed to apply for job');
        return;
      }

      alert('Applied Successfully');
      closeApplyModal();
      form.reset();

    } catch (err) {
      console.error('Apply error:', err);
      alert('Server error. Please try again.');
    }
  });
}

/* ===============================
   DATE FORMAT
================================ */

function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
/* ===============================
   MAKE FUNCTIONS GLOBAL
================================ */
window.filterJobs = filterJobs;
window.openApplyModal = openApplyModal;
window.closeApplyModal = closeApplyModal;
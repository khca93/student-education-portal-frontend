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

    if (data.success) {
      ALL_JOBS = data.jobs || [];
      filterJobs('government');
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
  if (card) card.classList.add('active');

  const jobs = ALL_JOBS.filter(j => j.jobType === type);
  renderJobs(jobs, type);
}

/* ===============================
   RENDER JOB LIST
================================ */

function renderJobs(jobs, type) {
  const list = document.getElementById('jobList');
  list.innerHTML = '';

  if (!jobs.length) {
    list.innerHTML = `<div class="job-card"><p>No jobs available.</p></div>`;
    return;
  }

  jobs.forEach(job => {
    list.insertAdjacentHTML('beforeend', jobCard(job, type));
  });
}

/* ===============================
   JOB CARD TEMPLATE
================================ */

function jobCard(job, type) {

  /* ===== GOVERNMENT JOB ===== */
  if (type === 'government') {
    return `
      <div class="job-card">
        <h3>${job.jobTitle || '-'}</h3>

        <p><b>Qualification:</b> ${job.qualification || '-'}</p>
        <p><b>Last Date:</b> ${formatDate(job.lastDate)}</p>

        ${job.jobPdf ? `
      <a
        href="${job.jobPdf.startsWith('http') ? job.jobPdf : API_URL + job.jobPdf}"
        class="btn btn-outline"
        target="_blank">
        View / Download PDF
      </a>
    ` : `<p><i>No PDF available</i></p>`}

          </div>
        `;
      }

  /* ===== PRIVATE / INFORMATION JOB ===== */
  if (type === 'information') {
    return `
      <div class="job-card info-card">
        <div class="job-card-header">
          <h3 class="job-title">${job.jobTitle || '-'}</h3>
          <span class="posted-date">
            <i class="fa-regular fa-calendar"></i>
            Posted: ${job.createdAt ? formatDate(job.createdAt) : '-'}
          </span>
        </div>

        <div class="job-card-body">
          <p><b>Company:</b> ${job.companyName || '-'}</p>
          <p class="job-desc">${job.jobDescription || ''}</p>
        </div>
      </div>
    `;
  }

  /* ===== INTERNSHIP / APPLY JOB ===== */
  return `
    <div class="job-card apply-card">
      <div class="job-card-header">
        <h3 class="job-title">${job.jobTitle || '-'}</h3>
        <span class="posted-date">
          <i class="fa-regular fa-calendar"></i>
          Posted: ${job.createdAt ? formatDate(job.createdAt) : '-'}
        </span>
      </div>

      <div class="job-card-body">
        <p><b>Qualification:</b> ${job.qualification || '-'}</p>
        <p><b>Company / Department:</b> ${job.companyName || '-'}</p>
        <p class="job-desc">${job.jobDescription || ''}</p>
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

    const formData = new FormData(form);

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

// ================= AUTH CHECK =================
const token = localStorage.getItem("studentToken");

console.log("DASHBOARD TOKEN:", token);

if (!token) {
  window.location.href = "../login.html";
  return;
}

// ================= API BASE =================
const API_URL =
  location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://student-education-portal-backend.onrender.com";

// ================= LOAD SAVED PAPERS =================
fetch(API_URL + "/api/student/auth/saved-papers", {
  method: "GET",
  headers: {
    "Authorization": "Bearer " + token
  }
})
  .then(res => res.json())
  .then(data => {
    console.log("SAVED PAPERS RESPONSE:", JSON.stringify(data, null, 2));

    const container = document.getElementById("savedPapers");
    container.innerHTML = "";

    if (!data.success || !data.papers || data.papers.length === 0) {
      container.innerHTML = "<p>No saved papers found</p>";
      return;
    }

    data.papers.forEach(p => {
      // ✅ ALWAYS encode before using in URL
      const safePdfPath = encodeURIComponent(p.pdfPath);

      const div = document.createElement("div");
      div.className = "paper-card";

      div.innerHTML = `
        <h4>${p.subject} (${p.year})</h4>
        <p>${p.category} | ${p["class"]}</p>

        <a
          href="${p.pdfPath}"
          target="_blank">
          View
        </a>

        <a
          href="${p.pdfPath}"
          download>
          Download
        </a>
      `;

      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error("Saved papers error:", err);
    document.getElementById("savedPapers").innerHTML =
      "<p>Error loading saved papers</p>";
  });

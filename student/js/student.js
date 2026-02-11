// ================= AUTH CHECK =================
const token = localStorage.getItem("studentToken");

console.log("DASHBOARD TOKEN:", token);

if (!token || token === "undefined" || token === "null") {
  localStorage.removeItem("studentToken");
  window.location.href = "../login.html";
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
  .then(async res => {
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("studentToken");
        window.location.href = "../login.html";
      }
      throw new Error("Failed to fetch saved papers");
    }
    return res.json();
  })
  .then(data => {
    const container = document.getElementById("savedPapers");
    container.innerHTML = "";

    if (!data.success || !Array.isArray(data.papers) || data.papers.length === 0) {
      container.innerHTML = "<p>No saved papers found</p>";
      return;
    }

    data.papers.forEach(p => {
      const div = document.createElement("div");
      div.className = "paper-card";

      div.innerHTML = `
        <h4>${p.subject || "-"} (${p.year || "-"})</h4>
        <p>${p.category || "-"} | ${p["class"] || "-"}</p>

        ${p.pdfPath ? `
          <a href="${p.pdfPath}" target="_blank" class="btn">
            <i class="fas fa-eye"></i> View PDF
          </a>

          <a href="${p.pdfPath}" download="${(p.subject || "paper").replace(/[^a-z0-9]/gi, "_")}_${p.year || ""}.pdf" class="btn">
            <i class="fas fa-download"></i> Download
          </a>
        ` : `<p>No PDF available</p>`}
      `;

      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error("Saved papers error:", err);
    document.getElementById("savedPapers").innerHTML =
      "<p>Error loading saved papers</p>";
  });

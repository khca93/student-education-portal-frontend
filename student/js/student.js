// ================= AUTH CHECK =================
const token = localStorage.getItem("studentToken");

console.log("DASHBOARD TOKEN:", token);

if (!token) {
  alert("Please login first");
  window.location.href = "../login.html";
}

// ================= LOAD SAVED PAPERS =================
fetch("http://localhost:5000/api/student/auth/saved-papers", {
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
    const div = document.createElement("div");
    div.className = "paper-card";

    div.innerHTML = `
      <h4>${p.subject} (${p.year})</h4>
      <p>${p.category} | ${p["class"]}</p>

      <a href="http://localhost:5000${p.pdfPath}" target="_blank">View</a>
      <a href="http://localhost:5000${p.pdfPath}" download>Download</a>
    `;

    container.appendChild(div);
  });
})
.catch(err => {
  console.error("Saved papers error:", err);
  document.getElementById("savedPapers").innerHTML =
    "<p>Error loading saved papers</p>";
});

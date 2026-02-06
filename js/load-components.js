// ================= LOAD HEADER & FOOTER (COMMON) =================
document.addEventListener("DOMContentLoaded", () => {

  const basePath = getBasePath(); // 🔥 auto detect path

  // ---------- HEADER ----------
  fetch(basePath + "components/header.html")
    .then(res => {
      if (!res.ok) throw new Error("Header not found");
      return res.text();
    })
    .then(html => {
      const header = document.getElementById("header-container");
      if (header) {
        header.innerHTML = html;
        initHeader(basePath); // after load
      }
    })
    .catch(err => console.error("Header load error:", err.message));

  // ---------- FOOTER ----------
  fetch(basePath + "components/footer.html")
    .then(res => {
      if (!res.ok) throw new Error("Footer not found");
      return res.text();
    })
    .then(html => {
      const footer = document.getElementById("footer-container");
      if (footer) footer.innerHTML = html;
    })
    .catch(err => console.error("Footer load error:", err.message));
});


// ================= PATH DETECTION =================
function getBasePath() {
  const host = window.location.hostname;
  const path = window.location.pathname;

  // 🔹 LIVE (Netlify / custom domain)
  if (
    host.includes("netlify.app") ||
    host.includes("khca.info")
  ) {
    return "/";   // root
  }

  // 🔹 OFFLINE (as it was)
  if (path.includes("/student/")) return "/frontend/";
  if (path.includes("/admin/")) return "/frontend/";

  return "/frontend/";
}



// ================= HEADER LOGIC =================
function initHeader(basePath) {

  // Hamburger
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("navMenu");

  if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
      navMenu.classList.toggle("active");
    });
  }

  updateHeaderAuthButtons(basePath);
  setActiveMenu();
}


// ================= ACTIVE MENU =================
function setActiveMenu() {
  let currentPath = window.location.pathname.replace(/\/$/, "");

  // 🔥 FIX FOR HOME PAGE
  if (currentPath === "") currentPath = "index.html";

  const links = document.querySelectorAll(".nav-menu a");

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;

    const cleanHref = href.replace(/\/$/, "");

    if (
      currentPath === cleanHref ||
      currentPath.endsWith("/" + cleanHref)
    ) {
      link.classList.add("active");

      const dropdown = link.closest(".dropdown");
      if (dropdown) {
        dropdown.querySelector("> a")?.classList.add("active");
      }
    }
  });
}





// ================= AUTH BUTTONS =================
function updateHeaderAuthButtons(basePath) {

  const authButtons = document.getElementById("authButtons");
  if (!authButtons) return;

  const studentToken = localStorage.getItem("studentToken");
  const adminToken = localStorage.getItem("adminToken");

  // 🔐 ASK BACKEND IF ADMIN
  if (adminToken) {
    fetch("https://student-education-portal-backend.onrender.com/api/admin/auth/check", {
      headers: {
        "Authorization": "Bearer " + adminToken
      }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.admin) {
          authButtons.innerHTML = `
            <a href="${basePath}admin/dashboard.html" class="btn btn-outline">Admin</a>
            <a href="#" class="btn btn-primary" onclick="logout('admin')">Logout</a>
          `;
        } else {
          localStorage.removeItem("adminToken");
          renderGuestButtons();
        }
      })
      .catch(() => {
        localStorage.removeItem("adminToken");
        renderGuestButtons();
      });
    return;
  }

  // STUDENT LOGIN
  if (studentToken) {
    authButtons.innerHTML = `
      <a href="${basePath}student/dashboard.html" class="btn btn-outline">Dashboard</a>
      <a href="#" class="btn btn-primary" onclick="logout('student')">Logout</a>
    `;
    return;
  }

  // GUEST
  renderGuestButtons();

  function renderGuestButtons() {
    authButtons.innerHTML = `
      <a href="${basePath}login.html" class="btn btn-outline">
        <i class="fas fa-user"></i> Login
      </a>
      <a href="${basePath}register.html" class="btn btn-primary">
        <i class="fas fa-user-plus"></i> Register
      </a>
    `;
  }
}



// ================= LOGOUT =================
function logout(type) {
  if (type === "student") localStorage.removeItem("studentToken");
  if (type === "admin") localStorage.removeItem("adminToken");

  window.location.href = getBasePath() + "login.html";

}

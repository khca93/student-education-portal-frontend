document.addEventListener("DOMContentLoaded", async () => {

  // Load Header
  const headerDiv = document.getElementById("header");
  if (headerDiv) {
    const res = await fetch("../components/header.html");
    headerDiv.innerHTML = await res.text();
  }

  // Load Footer
  const footerDiv = document.getElementById("footer");
  if (footerDiv) {
    const res = await fetch("../components/footer.html");
    footerDiv.innerHTML = await res.text();
  }

});

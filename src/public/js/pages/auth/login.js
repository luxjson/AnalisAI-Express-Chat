function switchTab(tipo) {
  const tabs = document.querySelectorAll(".login-tab");
  const forms = document.querySelectorAll(".login-form");
  const logo = document.getElementById("logoimg");

  tabs.forEach((tab) => tab.classList.remove("active", "professor", "aluno"));
  forms.forEach((form) => form.classList.remove("active"));

  if (tipo === "professor") {
    const tab = document.querySelector(".login-tab:nth-child(1)");
    tab.classList.add("active", "professor");
    document.getElementById("professorForm").classList.add("active");
    logo.src = "/images/logo3-white.png";
  } else {
    const tab = document.querySelector(".login-tab:nth-child(2)");
    tab.classList.add("active", "aluno");
    document.getElementById("alunoForm").classList.add("active");
    logo.src = "/images/logo3-green.png";
  }
}

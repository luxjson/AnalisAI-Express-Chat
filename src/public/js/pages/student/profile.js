function mudarAba(abaId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .getElementById("aba" + abaId.charAt(0).toUpperCase() + abaId.slice(1))
    .classList.add("active");
  const btns = { dados: 0, senha: 1 };
  document.querySelectorAll(".tab-btn")[btns[abaId]].classList.add("active");
  const url = new URL(window.location);
  url.searchParams.set("aba", abaId);
  window.history.pushState({}, "", url);
}

function toggleOpt(el, inpId) {
  el.classList.toggle("active");
  document.getElementById(inpId).value = el.classList.contains("active");
}

function salvarConfig() {
  const data = {
    notificacoes_ativas:
      document.getElementById("notificacoes_ativas").value === "true",
    notificacoes_avaliacoes:
      document.getElementById("notificacoes_avaliacoes").value === "true",
    notificacoes_tarefas: true,
  };
  fetch("/api/configuracoes-notificacoes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token":
        document.querySelector('meta[name="csrf-token"]')?.content || "",
    },
    body: JSON.stringify(data),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Erro ao salvar configurações");
      return result;
    })
    .then(() => {
      const al = document.getElementById("ajaxSucesso");
      al.style.display = "block";
      setTimeout(() => (al.style.display = "none"), 3000);
    });
}

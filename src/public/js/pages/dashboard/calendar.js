function getPageData(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || "null");
  } catch (error) {
    console.error("Falha ao ler dados da página.");
    return null;
  }
}

function showEventTab(tabName) {
  document.querySelectorAll("#eventoModal .tab-content").forEach((content) => {
    content.style.display = "none";
    content.classList.remove("active");
  });
  document.querySelectorAll("#eventoModal .tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const targetId =
    "event" + tabName.charAt(0).toUpperCase() + tabName.slice(1) + "Tab";
  const activeContent = document.getElementById(targetId);
  if (activeContent) {
    activeContent.style.display = "block";
    activeContent.classList.add("active");
  }
  document.getElementById("btn-event-" + tabName).classList.add("active");
}
let mesAtual = Number(getPageData("dashboard-calendario-data")?.mes);
let anoAtual = Number(getPageData("dashboard-calendario-data")?.ano);

function mudarMes(direcao) {
  mesAtual += direcao;
  if (mesAtual > 12) {
    mesAtual = 1;
    anoAtual++;
  } else if (mesAtual < 1) {
    mesAtual = 12;
    anoAtual--;
  }

  document.getElementById("mesInput").value = mesAtual;
  document.getElementById("anoInput").value = anoAtual;
  document.getElementById("filtroForm").submit();
}

function filtrarTurma(turma) {
  const form = document.getElementById("filtroForm");
  form.turma.value = turma;
  form.submit();
}

function abrirModalEvento() {
  document.getElementById("eventoModal").style.display = "flex";
}

function abrirModalFeriado() {
  document.getElementById("feriadoModal").style.display = "flex";
}

function fecharModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

async function removerEvento(id) {
  if (!confirm("Remover este evento?")) return;

  try {
    const response = await fetch(`/dashboard/calendario/evento/${id}`, {
      method: "DELETE",
      headers: {
        "X-CSRF-Token":
          document.querySelector('meta[name="csrf-token"]')?.content || "",
      },
    });

    if (response.ok) {
      location.reload();
    }
  } catch (err) {
    console.error(err);
  }
}

window.onclick = function (event) {
  if (event.target.classList.contains("modal-overlay")) {
    event.target.style.display = "none";
  }
};

async function removerItem(tipo, id) {
  if (!confirm(`Remover este ${tipo}?`)) return;

  try {
    let url = "";
    if (tipo === "feriado") {
      url = `/dashboard/calendario/feriado/${id}`;
    } else {
      url = `/dashboard/calendario/evento/${id}`;
    }

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-CSRF-Token":
          document.querySelector('meta[name="csrf-token"]')?.content || "",
      },
    });
    if (response.ok) location.reload();
  } catch (err) {
    console.error(err);
  }
}

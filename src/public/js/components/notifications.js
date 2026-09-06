let notificacoesInterval;
let notificacoesAtivas = true;

function toggleNotificacoes() {
  if (!notificacoesAtivas) {
    return;
  }
  const popup = document.getElementById("notificacoesPopup");
  popup.classList.toggle("mostrar");
  if (popup.classList.contains("mostrar")) {
    carregarNotificacoes();
  }
}

function carregarConfiguracoes() {
  fetch("/api/configuracoes-notificacoes")
    .then((response) => response.json())
    .then((config) => {
      notificacoesAtivas = config.notificacoes_ativas !== false;
      const icone = document.getElementById("sinoIcone");
      if (!notificacoesAtivas) {
        icone.className = "fas fa-bell-slash";
        document.getElementById("notificacoesBadge").style.display = "none";
      } else {
        icone.className = "fas fa-bell";
        carregarNotificacoes();
      }
    });
}

function carregarNotificacoes() {
  fetch("/api/notificacoes")
    .then((response) => response.json())
    .then((data) => {
      atualizarListaNotificacoes(data.notificacoes);
      atualizarBadge(data.totalNaoLidas);
    });
}

function atualizarListaNotificacoes(notificacoes) {
  const lista = document.getElementById("notificacoesLista");

  if (notificacoes.length === 0) {
    lista.innerHTML =
      '<div class="notificacoes-vazio"><i class="far fa-bell-slash"></i> Nenhuma notificação</div>';
    return;
  }

  let html = "";
  notificacoes.forEach((notif) => {
    const data = new Date(notif.data_criacao).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    html += `
            <div class="notificacao-item ${notif.lida ? "" : "nao-lida"}" data-id="${notif.id}">
                <div class="notificacao-icone" style="background: ${escapeHtml(notif.cor)}20; color: ${escapeHtml(notif.cor)};">
                    <i class="${escapeHtml(notif.icone)}"></i>
                </div>
                <div class="notificacao-conteudo" onclick="abrirNotificacao(${escapeHtml(JSON.stringify(notif.link))})">
                    <div class="notificacao-titulo">${escapeHtml(notif.titulo)}</div>
                    <div class="notificacao-mensagem">${escapeHtml(notif.mensagem)}</div>
                    <div class="notificacao-data">${escapeHtml(data)}</div>
                </div>
                ${
                  !notif.lida
                    ? `
                <div class="notificacao-acoes">
                    <button class="notificacao-marcar" onclick="marcarComoLida(${notif.id})" title="Marcar como lida">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
                `
                    : ""
                }
            </div>
        `;
  });

  lista.innerHTML = html;
}

function atualizarBadge(total) {
  const badge = document.getElementById("notificacoesBadge");

  if (total > 0) {
    badge.style.display = "flex";
    badge.textContent = total > 9 ? "9+" : total;
  } else {
    badge.style.display = "none";
  }
}

function marcarComoLida(id) {
  fetch(`/api/notificacoes/marcar-lida/${id}`, {
    method: "POST",
    headers: {
      "X-CSRF-Token":
        document.querySelector('meta[name="csrf-token"]')?.content || "",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        carregarNotificacoes();
      }
    });
}

function marcarTodasLidas() {
  fetch("/api/notificacoes/marcar-todas-lidas", {
    method: "POST",
    headers: {
      "X-CSRF-Token":
        document.querySelector('meta[name="csrf-token"]')?.content || "",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        carregarNotificacoes();
      }
    });
}

function abrirNotificacao(link) {
  if (link) {
    window.location.href = link;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const configLink = document.getElementById("notificacoesConfigLink");
  if (configLink) {
    configLink.href = "#";
    configLink.addEventListener("click", (event) => {
      event.preventDefault();
      document.getElementById("notificacoesPopup")?.classList.remove("mostrar");
      window.dispatchEvent(
        new CustomEvent("analisai:open-settings", {
          detail: { section: "notifications" },
        }),
      );
    });
  }

  carregarConfiguracoes();
  notificacoesInterval = setInterval(carregarNotificacoes, 30000);

  document.addEventListener("click", function (event) {
    const container = document.querySelector(".notificacoes-container");
    const popup = document.getElementById("notificacoesPopup");

    if (container && popup && !container.contains(event.target)) {
      popup.classList.remove("mostrar");
    }
  });
});

window.addEventListener("beforeunload", function () {
  if (notificacoesInterval) {
    clearInterval(notificacoesInterval);
  }
});

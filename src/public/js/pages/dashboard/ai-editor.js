(function () {
  const button = document.getElementById("aiAnalyzeStudent");
  const select = document.getElementById("aiStudentSelect");
  const result = document.getElementById("aiEditorResult");
  if (!button || !select || !result) return;
  const suggestionButtons = document.querySelectorAll("[data-ai-prompt]");

  function escapeHtml(value) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  function renderMarkdown(value) {
    if (typeof window.renderAssistantMarkdown === "function") {
      return window.renderAssistantMarkdown(value);
    }
    if (!value) return "";
    let text = escapeHtml(
      String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    );
    function formatInline(str) {
      return str
        .replace(/\*\*\*([^\*\n]+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*([^\*\n]+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_\n]+?)__/g, "<strong>$1</strong>")
        .replace(/\*([^\*\n\s](?:[^\*\n]*?[^\*\n\s])?)\*/g, "<em>$1</em>");
    }
    const lines = text.split("\n");
    const out = [];
    let currentList = null;
    let currentParagraph = [];
    function flushParagraph() {
      if (currentParagraph.length > 0) {
        out.push(`<p>${currentParagraph.map(formatInline).join("<br>")}</p>`);
        currentParagraph = [];
      }
    }
    function flushList() {
      if (currentList) {
        out.push(`</${currentList}>`);
        currentList = null;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }
      if (/^([*_-][ \t]*){3,}$/.test(trimmed)) {
        flushParagraph();
        flushList();
        out.push("<hr>");
        continue;
      }
      const decoMatch = trimmed.match(/^((?:[*_-]{3,}[ \t]*)+)(.+)$/);
      if (decoMatch) {
        flushParagraph();
        flushList();
        out.push("<hr>");
        trimmed = decoMatch[2].trim();
        line = trimmed;
      }
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = Math.min(Math.max(headingMatch[1].length, 2), 5);
        out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
        continue;
      }
      const ulMatch = line.match(/^(\s*)([*+-])\s+(.+)$/);
      if (ulMatch) {
        flushParagraph();
        if (currentList !== "ul") {
          flushList();
          out.push("<ul>");
          currentList = "ul";
        }
        out.push(`  <li>${formatInline(ulMatch[3])}</li>`);
        continue;
      }
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (olMatch) {
        flushParagraph();
        if (currentList !== "ol") {
          flushList();
          out.push("<ol>");
          currentList = "ol";
        }
        out.push(
          `  <li value="${olMatch[2]}">${formatInline(olMatch[3])}</li>`,
        );
        continue;
      }
      flushList();
      currentParagraph.push(trimmed);
    }
    flushParagraph();
    flushList();
    return out.join("\n");
  }

  async function analyze(message) {
    if (!select.value) {
      result.innerHTML = "<p>Selecione um aluno para iniciar a análise.</p>";
      return;
    }
    button.disabled = true;
    suggestionButtons.forEach((item) => {
      item.disabled = true;
    });
    result.innerHTML = "<p><em>Analisando dados do aluno...</em></p>";
    try {
      const response = await fetch(
        `/api/ia/professor/aluno/${encodeURIComponent(select.value)}/analisar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')
              .content,
          },
          body: JSON.stringify({ message }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível analisar o aluno.");
      result.innerHTML = renderMarkdown(data.answer);
    } catch (error) {
      result.innerHTML = `<p style="color: var(--primary-red);">${escapeHtml(error.message)}</p>`;
    } finally {
      button.disabled = false;
      suggestionButtons.forEach((item) => {
        item.disabled = false;
      });
    }
  }

  button.addEventListener("click", () =>
    analyze(
      "Faça um diagnóstico pedagógico completo em texto corrido sobre este aluno. Analise situação atual, pontos fortes, prioridades de intervenção e próximos passos práticos.",
    ),
  );
  suggestionButtons.forEach((item) =>
    item.addEventListener("click", () => analyze(item.dataset.aiPrompt)),
  );
})();

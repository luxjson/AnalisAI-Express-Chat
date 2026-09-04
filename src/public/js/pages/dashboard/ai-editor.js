(function () {
    const button = document.getElementById('aiAnalyzeStudent');
    const select = document.getElementById('aiStudentSelect');
    const result = document.getElementById('aiEditorResult');
    if (!button || !select || !result) return;
    const suggestionButtons = document.querySelectorAll('[data-ai-prompt]');

    async function analyze(message) {
        if (!select.value) {
            result.textContent = 'Selecione um aluno para iniciar a análise.';
            return;
        }
        button.disabled = true;
        suggestionButtons.forEach(item => { item.disabled = true; });
        result.textContent = 'Analisando dados do aluno...';
        try {
            const response = await fetch(`/api/ia/professor/aluno/${encodeURIComponent(select.value)}/analisar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Não foi possível analisar o aluno.');
            result.textContent = data.answer;
        } catch (error) {
            result.textContent = error.message;
        } finally {
            button.disabled = false;
            suggestionButtons.forEach(item => { item.disabled = false; });
        }
    }

    button.addEventListener('click', () => analyze('Faça um diagnóstico pedagógico conciso deste aluno. Liste situação atual, pontos fortes, prioridades de intervenção e próximos passos práticos.'));
    suggestionButtons.forEach(item => item.addEventListener('click', () => analyze(item.dataset.aiPrompt)));
})();
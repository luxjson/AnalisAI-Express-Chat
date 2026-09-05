(function () {
    const chat = document.querySelector('.ai-chat');
    if (!chat) return;
    const endpoint = chat.dataset.endpoint;
    const form = chat.querySelector('.ai-form');
    const input = form.querySelector('textarea');
    const messages = chat.querySelector('.ai-messages');
    const historyPanel = chat.querySelector('.ai-history');
    const historyList = chat.querySelector('.ai-history-list');
    const initialMessages = messages.innerHTML;
    let conversationId = null;
    let sending = false;

    async function getCsrfToken() {
        const tokenResponse = await fetch('/api/csrf-token', { cache: 'no-store' });
        const tokenData = await tokenResponse.json().catch(() => ({}));
        if (!tokenResponse.ok || !tokenData.csrfToken) {
            throw new Error(tokenData.error || 'Não foi possível validar a sessão.');
        }
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) meta.content = tokenData.csrfToken;
        return tokenData.csrfToken;
    }

    async function csrfFetch(url, options = {}) {
        const token = await getCsrfToken();
        const headers = new Headers(options.headers || {});
        headers.set('X-CSRF-Token', token);
        let response = await fetch(url, { ...options, headers });
        if (response.status !== 403) return response;
        const preview = await response.clone().json().catch(() => ({}));
        if (preview.error !== 'Token CSRF inválido.') return response;
        const refreshedToken = await getCsrfToken();
        headers.set('X-CSRF-Token', refreshedToken);
        response = await fetch(url, { ...options, headers });
        return response;
    }

    function resizeInput() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }

    function escapeHtml(value) {
        return value.replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[character]));
    }

    function renderMath(value) {
        let formula = value.trim()
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="ai-fraction"><span>$1</span><span>$2</span></span>')
            .replace(/\\div/g, '÷')
            .replace(/\\times/g, '×')
            .replace(/\\cdot/g, '·')
            .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
            .replace(/\^([A-Za-z0-9]+)/g, '<sup>$1</sup>');
        return `<span class="ai-math">${formula}</span>`;
    }

    function renderAssistantText(value) {
        if (!value) return '';
        let text = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 1. Math formulas
        const mathBlocks = [];
        text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, block, bracket, inline, dollar) => {
            const token = `@@AI_MATH_${mathBlocks.length}@@`;
            mathBlocks.push(renderMath(block || bracket || inline || dollar));
            return token;
        });

        // 2. Code blocks
        const codeBlocks = [];
        text = text.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_, lang, code) => {
            const token = `@@AI_CODE_${codeBlocks.length}@@`;
            codeBlocks.push(`<pre><code class="language-${escapeHtml(lang || 'text')}">${escapeHtml(code.trim())}</code></pre>`);
            return token;
        });

        // 3. Inline code
        const inlineCodes = [];
        text = text.replace(/`([^`\n]+)`/g, (_, code) => {
            const token = `@@AI_INLINE_${inlineCodes.length}@@`;
            inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
            return token;
        });

        // Escape HTML for security
        text = escapeHtml(text);

        // Format inline markdown (bold, italic, bold+italic)
        function formatInline(str) {
            return str
                // Bold + Italic: ***text*** or ___text___
                .replace(/\*\*\*([^\*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/___([^_\n]+?)___/g, '<strong><em>$1</em></strong>')
                // Bold: **text** or __text__
                .replace(/\*\*([^\*\n]+?)\*\*/g, '<strong>$1</strong>')
                .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
                // Italic: *text* (avoiding lone asterisks)
                .replace(/\*([^\*\n\s](?:[^\*\n]*?[^\*\n\s])?)\*/g, '<em>$1</em>')
                .replace(/(^|[\s\(\[\{])_([^_\n\s](?:[^_\n]*?[^_\n\s])?)_([\s\)\]\}]|$)/g, '$1<em>$2</em>$3');
        }

        const lines = text.split('\n');
        const out = [];
        let currentList = null; // 'ul' | 'ol'
        let currentParagraph = [];

        function flushParagraph() {
            if (currentParagraph.length > 0) {
                out.push(`<p>${currentParagraph.map(formatInline).join('<br>')}</p>`);
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

            // Standalone horizontal rules: ---, ***, ___
            if (/^([*_-][ \t]*){3,}$/.test(trimmed)) {
                flushParagraph();
                flushList();
                out.push('<hr>');
                continue;
            }

            // Decorative leading dividers before text: *** --- Texto
            const decoMatch = trimmed.match(/^((?:[*_-]{3,}[ \t]*)+)(.+)$/);
            if (decoMatch) {
                flushParagraph();
                flushList();
                out.push('<hr>');
                trimmed = decoMatch[2].trim();
                line = trimmed;
            }

            // Headings: #, ##, ###, ####, #####
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                flushParagraph();
                flushList();
                const level = Math.min(Math.max(headingMatch[1].length, 2), 5);
                out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
                continue;
            }

            // Unordered list items: * or - (with optional indentation)
            const ulMatch = line.match(/^(\s*)([*+-])\s+(.+)$/);
            if (ulMatch) {
                flushParagraph();
                const indent = ulMatch[1].length;
                const content = formatInline(ulMatch[3]);
                if (currentList !== 'ul') {
                    flushList();
                    out.push('<ul>');
                    currentList = 'ul';
                }
                if (indent >= 2) {
                    out.push(`  <li class="ai-nested-li">${content}</li>`);
                } else {
                    out.push(`  <li>${content}</li>`);
                }
                continue;
            }

            // Ordered list items: 1. 2. etc
            const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
            if (olMatch) {
                flushParagraph();
                const content = formatInline(olMatch[3]);
                if (currentList !== 'ol') {
                    flushList();
                    out.push('<ol>');
                    currentList = 'ol';
                }
                out.push(`  <li value="${olMatch[2]}">${content}</li>`);
                continue;
            }

            // Regular paragraph line
            flushList();
            currentParagraph.push(trimmed);
        }

        flushParagraph();
        flushList();

        let result = out.join('\n');

        // Restore math formulas
        mathBlocks.forEach((formula, index) => {
            result = result.replace(`@@AI_MATH_${index}@@`, formula);
        });

        // Restore inline codes
        inlineCodes.forEach((code, index) => {
            result = result.replace(`@@AI_INLINE_${index}@@`, code);
        });

        // Restore code blocks
        codeBlocks.forEach((code, index) => {
            result = result.replace(`@@AI_CODE_${index}@@`, code);
        });

        return result;
    }

    window.renderAssistantMarkdown = renderAssistantText;

    function addMessage(text, type) {
        chat.classList.add('has-messages');
        const element = document.createElement('div');
        element.className = `ai-message ai-message-${type}`;
        if (type === 'assistant' || type === 'system') element.innerHTML = renderAssistantText(text);
        else element.textContent = text;
        messages.appendChild(element);
        messages.scrollTop = messages.scrollHeight;
        return element;
    }

    function addGradeAction(action) {
        const element = document.createElement('div');
        element.className = 'ai-grade-action';
        element.innerHTML = '<div><strong>Confirmar alteração?</strong><span></span></div><button type="button"><i class="fas fa-check"></i> Aplicar</button>';
        element.querySelector('span').textContent = `${action.alunoNome} · ${action.competenciaNome} · nota ${action.nota}`;
        element.querySelector('button').addEventListener('click', async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                const response = await fetch('/api/ia/professor/alterar-nota', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
                    body: JSON.stringify({ ...action, confirm: true })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Não foi possível alterar a nota.');
                element.classList.add('is-done');
                button.innerHTML = '<i class="fas fa-check"></i> Aplicada';
                addMessage(data.message, 'assistant');
            } catch (error) {
                button.disabled = false;
                addMessage(error.message, 'error');
            }
        });
        messages.appendChild(element);
        messages.scrollTop = messages.scrollHeight;
    }

    function setMessages(conversationMessages) {
        messages.innerHTML = '';
        chat.classList.add('has-messages');
        conversationMessages.forEach(message => addMessage(message.text, message.role === 'model' ? 'assistant' : 'user'));
    }

    function closeHistory() {
        historyPanel.classList.remove('is-open');
        historyPanel.setAttribute('aria-hidden', 'true');
    }

    function formatDate(value) {
        return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    function renderHistory(conversations) {
        historyList.innerHTML = '';
        if (!conversations.length) {
            historyList.innerHTML = '<div class="ai-history-empty"><p>Nenhuma conversa salva ainda.</p></div>';
            return;
        }
        conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            item.className = 'ai-history-item';
            item.innerHTML = `<span class="ai-history-item-icon"><i class="fas fa-message"></i></span><span class="ai-history-item-copy"><strong></strong><small>${conversation.fixado ? 'Fixado · ' : ''}${formatDate(conversation.data_atualizacao)}</small></span><span class="ai-history-item-actions"><button type="button" data-action="fixar" title="Fixar conversa"><i class="fas fa-thumbtack"></i></button><button type="button" data-action="renomear" title="Renomear conversa"><i class="fas fa-pen"></i></button><button type="button" data-action="apagar" title="Apagar conversa"><i class="fas fa-trash"></i></button></span>`;
            item.querySelector('strong').textContent = conversation.titulo;
            item.addEventListener('click', () => {
                conversationId = conversation.id;
                setMessages(conversation.messages || []);
                closeHistory();
            });
            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.click();
                }
            });
            item.querySelectorAll('[data-action]').forEach(actionButton => actionButton.addEventListener('click', async event => {
                event.stopPropagation();
                const action = actionButton.dataset.action;
                let titulo;
                if (action === 'renomear') {
                    titulo = window.prompt('Nome da conversa:', conversation.titulo);
                    if (!titulo || !titulo.trim()) return;
                }
                if (action === 'apagar' && !window.confirm('Apagar esta conversa e todas as mensagens?')) return;
                actionButton.disabled = true;
                try {
                    const response = await csrfFetch(`/api/ia/historico/${conversation.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
                        body: JSON.stringify({ acao: action, titulo })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a conversa.');
                    if (action === 'apagar') {
                        item.remove();
                        if (conversationId === conversation.id) newChat().catch(error => addMessage(error.message, 'error'));
                    } else if (action === 'renomear') {
                        conversation.titulo = data.conversation.titulo;
                        item.querySelector('strong').textContent = conversation.titulo;
                    } else {
                        conversation.fixado = data.conversation.fixado;
                        await openHistory();
                    }
                } catch (error) {
                    addMessage(error.message, 'error');
                } finally {
                    actionButton.disabled = false;
                }
            }));
            historyList.appendChild(item);
        });
    }

    async function openHistory() {
        historyPanel.classList.add('is-open');
        historyPanel.setAttribute('aria-hidden', 'false');
        historyList.innerHTML = '<div class="ai-history-loading"><span></span><span></span><span></span></div>';
        try {
            const response = await fetch('/api/ia/historico');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o histórico.');
            renderHistory(data.conversations || []);
        } catch (error) {
            historyList.innerHTML = `<div class="ai-history-empty"><i class="fas fa-triangle-exclamation"></i><p>${error.message}</p></div>`;
        }
    }

    async function newChat() {
        if (sending) return;
        conversationId = null;
        messages.innerHTML = initialMessages;
        chat.classList.remove('has-messages');
        closeHistory();
        input.value = '';
        resizeInput();
        input.focus();
    }

    async function sendMessage(message) {
        const cleanMessage = message.trim();
        if (!cleanMessage || sending) return;
        sending = true;
        addMessage(cleanMessage, 'user');
        input.value = '';
        resizeInput();
        input.disabled = true;
        const loading = addMessage('Analisando os dados...', 'loading');
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content },
                body: JSON.stringify({ message: cleanMessage, conversationId })
            });
            const data = await response.json();
            loading.remove();
            if (data.conversationId) conversationId = data.conversationId;
            if (!response.ok) throw new Error(data.error || 'Não foi possível obter uma resposta.');
            addMessage(data.answer, 'assistant');
            if (data.action?.type === 'update_grade') addGradeAction(data.action);
            conversationId = data.conversationId || conversationId;
        } catch (error) {
            loading.remove();
            addMessage(error.message, 'error');
        } finally {
            sending = false;
            input.disabled = false;
            input.focus();
        }
    }

    form.addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
    chat.querySelector('[data-new-chat]').addEventListener('click', () => newChat().catch(error => addMessage(error.message, 'error')));
    chat.querySelector('[data-history]').addEventListener('click', openHistory);
    chat.querySelectorAll('[data-close-history]').forEach(element => element.addEventListener('click', closeHistory));
    input.addEventListener('input', resizeInput);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    chat.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
    resizeInput();
})();
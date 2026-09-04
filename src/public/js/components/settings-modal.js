document.addEventListener('DOMContentLoaded', () => {
    const modal = document.querySelector('.settings-modal');
    if (!modal) return;

    const validSections = new Set(['general', 'account', 'privacy', 'notifications']);
    const setSection = (section) => {
        const selected = validSections.has(section) ? section : 'general';
        modal.querySelectorAll('[data-settings-section]').forEach(button => {
            button.classList.toggle('active', button.dataset.settingsSection === selected);
        });
        modal.querySelectorAll('[data-settings-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.settingsPanel === selected);
        });
        if (selected === 'notifications') loadNotifications();
    };

    const openSettings = (section = 'general') => {
        setSection(section);
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    };

    window.addEventListener('analisai:open-settings', event => openSettings(event.detail?.section || 'general'));

    modal.querySelectorAll('[data-settings-section]').forEach(button => {
        button.addEventListener('click', () => setSection(button.dataset.settingsSection));
    });

    const search = modal.querySelector('[data-settings-search]');
    const navItems = [...modal.querySelectorAll('[data-settings-section]')];
    const navLabels = [...modal.querySelectorAll('.settings-nav-label')];
    const panels = [...modal.querySelectorAll('[data-settings-panel]')];
    search?.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase('pt-BR');
        if (!query) {
            navItems.forEach(item => { item.hidden = false; });
            panels.forEach(panel => { panel.hidden = false; });
            navLabels.forEach(label => { label.hidden = false; });
            return;
        }

        const matches = new Set();
        panels.forEach(panel => {
            const text = panel.textContent.trim().toLocaleLowerCase('pt-BR');
            if (text.includes(query)) matches.add(panel.dataset.settingsPanel);
            panel.hidden = !text.includes(query);
        });

        navItems.forEach(item => {
            const section = item.dataset.settingsSection;
            const navText = item.textContent.trim().toLocaleLowerCase('pt-BR');
            const visible = navText.includes(query) || matches.has(section);
            item.hidden = !visible;
        });

        navLabels.forEach(label => {
            let item = label.nextElementSibling;
            let visible = false;
            while (item && !item.classList.contains('settings-nav-label')) {
                if (!item.hidden) visible = true;
                item = item.nextElementSibling;
            }
            label.hidden = !visible;
        });

        const firstMatch = navItems.find(item => !item.hidden);
        if (firstMatch) setSection(firstMatch.dataset.settingsSection);
    });

    const fill = (key, value) => {
        modal.querySelectorAll(`[data-account="${key}"]`).forEach(el => {
            if (value !== undefined && value !== null) el.textContent = String(value);
        });
    };

    const loadAccount = async () => {
        try {
            const response = await fetch('/api/conta', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
            if (!response.ok) throw new Error('Não foi possível carregar os dados da conta');
            const data = await response.json();
            Object.entries(data).forEach(([key, value]) => fill(key, value));
        } catch (error) {
            console.error('Erro ao carregar conta:', error);
            modal.querySelectorAll('[data-account]').forEach(el => {
                if (el.textContent === 'Carregando...' || el.textContent === '—') el.textContent = '—';
            });
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await fetch('/api/configuracoes-notificacoes');
            if (!response.ok) throw new Error('Não foi possível carregar as notificações');
            const config = await response.json();
            modal.querySelectorAll('[data-notification]').forEach(toggle => {
                toggle.classList.toggle('active', Boolean(config[toggle.dataset.notification]));
            });
        } catch (error) {
            const feedback = modal.querySelector('[data-settings-feedback]');
            if (feedback) feedback.textContent = error.message;
        }
    };

    modal.querySelectorAll('[data-notification]').forEach(toggle => {
        toggle.addEventListener('click', () => toggle.classList.toggle('active'));
    });

    modal.querySelector('[data-save-notifications]')?.addEventListener('click', async () => {
        const data = {};
        modal.querySelectorAll('[data-notification]').forEach(toggle => {
            data[toggle.dataset.notification] = toggle.classList.contains('active');
        });
        const feedback = modal.querySelector('[data-settings-feedback]');
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const response = await fetch('/api/configuracoes-notificacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Não foi possível salvar as notificações');
            if (feedback) { feedback.textContent = 'Preferências salvas.'; feedback.classList.add('is-success'); feedback.classList.remove('is-error'); }
        } catch (error) {
            if (feedback) { feedback.textContent = error.message; feedback.classList.add('is-error'); feedback.classList.remove('is-success'); }
        }
    });

    // Tema único: escuro. Não há controle de aparência neste popup.

    loadAccount();
    const requestedSection = new URLSearchParams(window.location.search).get('settings');
    if (requestedSection) {
        openSettings(requestedSection);
        const url = new URL(window.location.href);
        url.searchParams.delete('settings');
        history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
});

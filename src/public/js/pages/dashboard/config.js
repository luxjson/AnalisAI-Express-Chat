function mudarAba(abaId) {
            document.querySelectorAll('.tab-trigger').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            const btnIdx = { 'dados': 0, 'notificacoes': 1, 'senha': 2 };
            document.querySelectorAll('.tab-trigger')[btnIdx[abaId]].classList.add('active');
            document.getElementById('aba' + abaId.charAt(0).toUpperCase() + abaId.slice(1)).classList.add('active');

            const url = new URL(window.location);
            url.searchParams.set('aba', abaId);
            window.history.pushState({}, '', url);
        }
        
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', function() {
                this.classList.toggle('ativo');
                const inputId = this.getAttribute('data-input');
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = this.classList.contains('ativo');
                }
            });
        });
        
        function salvarConfiguracoes() {
            const config = {
                notificacoes_ativas: document.getElementById('notificacoes_ativas').value === 'true',
                notificacoes_tarefas: document.getElementById('notificacoes_tarefas').value === 'true',
                notificacoes_avaliacoes: document.getElementById('notificacoes_avaliacoes').value === 'true',
                notificacoes_competencias: document.getElementById('notificacoes_competencias').value === 'true'
            };
            
            fetch('/api/configuracoes-notificacoes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: JSON.stringify(config)
            })
            .then(async response => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Erro ao salvar configurações');
                return data;
            })
                .then(data => {
                const msg = document.getElementById('mensagemSucesso');
                msg.style.display = 'flex';
                setTimeout(() => { msg.style.display = 'none'; }, 3000);
                if (typeof carregarConfiguracoes === 'function') {
                    carregarConfiguracoes();
                }
            })
            .catch(error => alert('Erro ao salvar configurações'));
        }

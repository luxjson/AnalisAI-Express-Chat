function abrirModalAprovar(id, nome) {
            document.getElementById('formAprovar').action = `/dashboard/solicitacoes-senha/aprovar/${id}`;
            document.getElementById('nomeAprovar').innerHTML = `<strong>${escapeHtml(nome)}</strong>`;
            document.getElementById('modalAprovar').style.display = 'flex';
        }
        
        function abrirModalRejeitar(id, nome) {
            document.getElementById('formRejeitar').action = `/dashboard/solicitacoes-senha/rejeitar/${id}`;
            document.getElementById('nomeRejeitar').innerHTML = `<strong>${escapeHtml(nome)}</strong>`;
            document.getElementById('modalRejeitar').style.display = 'flex';
        }
        
        function fecharModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

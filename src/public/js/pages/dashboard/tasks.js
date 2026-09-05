function showEditTaskTab(tabName) {
            document.querySelectorAll('#editarTarefaModal .tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            document.querySelectorAll('#editarTarefaModal .tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            const targetId = 'editTask' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab';
            const activeContent = document.getElementById(targetId);
            if(activeContent) {
                activeContent.style.display = 'block';
                activeContent.classList.add('active');
            }

            document.getElementById('btn-edit-task-' + tabName).classList.add('active');
            }
        function showTaskTab(tabName) {
            document.querySelectorAll('#novaTarefaModal .tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            document.querySelectorAll('#novaTarefaModal .tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            const targetId = 'task' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab';
            const activeContent = document.getElementById(targetId);
            if(activeContent) {
                activeContent.style.display = 'block';
                activeContent.classList.add('active');
            }
            
            document.getElementById('btn-task-' + tabName).classList.add('active');
        }

        function abrirModalNovaTarefa() {
            document.getElementById('novaTarefaModal').style.display = 'flex';
        }
        
        function fecharModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        function toggleTodosAlunos() {
            const selecionarTodos = document.getElementById('selecionarTodosAlunos');
            const alunosVisiveis = document.querySelectorAll('#novaTarefaModal .aluno-tarefa-item[style="display: flex"], #novaTarefaModal .aluno-tarefa-item:not([style*="display: none"])');
            
            alunosVisiveis.forEach(item => {
                const checkbox = item.querySelector('.aluno-checkbox');
                if (checkbox) {
                    checkbox.checked = selecionarTodos.checked;
                }
            });
        }
        
        function verTarefa(id) {
            fetch(`/dashboard/tarefas/${id}`)
                .then(response => response.json())
                .then(data => {
                    let html = `
                        <div style="margin-bottom: 25px;">
                            <h3 style="color:#fff; font-size:1.3rem; margin-bottom:15px; text-align:center; border-bottom:1px solid #333; padding-bottom:10px;">
                                ${escapeHtml(data.tarefa.titulo)}
                            </h3>
                            
                            <p style="color:#888; margin-bottom:20px; line-height:1.6; background:#111; padding:15px; border-radius:8px;">
                                ${escapeHtml(data.tarefa.descricao || 'Sem descrição')}
                            </p>
                            
                            <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:25px;">
                                <div style="background:#111; padding:12px; border-radius:8px;">
                                    <div style="color:#666; font-size:0.7rem; text-transform:uppercase; margin-bottom:3px;">TURMA</div>
                                    <div style="color:#fff; font-size:1rem;">${escapeHtml(data.tarefa.turma)}</div>
                                </div>
                                <div style="background:#111; padding:12px; border-radius:8px;">
                                    <div style="color:#666; font-size:0.7rem; text-transform:uppercase; margin-bottom:3px;">DATA DE ENTREGA</div>
                                    <div style="color:#fff; font-size:1rem;">${data.tarefa.data_entrega ? new Date(data.tarefa.data_entrega).toLocaleDateString('pt-BR') : 'Sem data'}</div>
                                </div>
                                <div style="background:#111; padding:12px; border-radius:8px;">
                                    <div style="color:#666; font-size:0.7rem; text-transform:uppercase; margin-bottom:3px;">PRIORIDADE</div>
                                    <div style="color:#fff; font-size:1rem;">${escapeHtml(data.tarefa.prioridade)}</div>
                                </div>
                                <div style="background:#111; padding:12px; border-radius:8px;">
                                    <div style="color:#666; font-size:0.7rem; text-transform:uppercase; margin-bottom:3px;">STATUS</div>
                                    <div style="color:#fff; font-size:1rem;">${escapeHtml(data.tarefa.status)}</div>
                                </div>
                            </div>
                            
                            <h4 style="color:#fff; margin-bottom:15px; font-size:1rem;">
                                <i class="fas fa-users"></i> ALUNOS (${data.alunos.length})
                            </h4>
                            
                            <div style="max-height:400px; overflow-y:auto; padding-right:5px;">
                    `;
                    
                    data.alunos.forEach(aluno => {
                        let statusText = '';
                        let statusCor = '';
                        
                        if (aluno.status_tarefa === 'CONCLUIDA') {
                            statusText = 'CORRIGIDA';
                            statusCor = '#217346';
                        } else if (aluno.status_tarefa === 'ENTREGUE') {
                            statusText = 'AGUARDANDO CORREÇÃO';
                            statusCor = '#217346';
                        } else if (aluno.status_tarefa === 'DEVOLVIDA') {
                            statusText = 'DEVOLVIDA';
                            statusCor = '#ffa500';
                        } else if (aluno.status_tarefa === 'ATRASADA') {
                            statusText = 'ATRASADA';
                            statusCor = '#ff0101';
                        } else {
                            statusText = 'PENDENTE';
                            statusCor = '#d4a017';
                        }
                        
                        html += `
                            <div style="background:#111; border-radius:8px; padding:15px; margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <div>
                                        <span style="color:#fff; font-size:1rem;">${escapeHtml(aluno.nome)}</span>
                                        <span style="color:#888; font-size:0.75rem; margin-left:8px;">${escapeHtml(aluno.ano_escolar)}</span>
                                    </div>
                                    <span style="color:${statusCor}; font-size:0.8rem; background:#151515; padding:4px 10px; border-radius:15px;">
                                        ${statusText}
                                    </span>
                                </div>
                                
                                ${aluno.resposta_texto ? `
                                    <div style="background:#151515; padding:8px; border-radius:6px; margin-top:8px;">
                                        <span style="color:#888; font-size:0.7rem;">Resposta:</span>
                                        <p style="color:#ccc; font-size:0.85rem; margin-top:5px;">${escapeHtml(aluno.resposta_texto)}</p>
                                    </div>
                                ` : ''}
                                
                                ${aluno.resposta_arquivo ? `
                                    <div style="background:#151515; padding:8px; border-radius:6px; margin-top:8px;">
                                        <span style="color:#888; font-size:0.7rem;">Arquivo:</span>
                                        <a href="/uploads/${escapeHtml(aluno.resposta_arquivo)}" target="_blank" style="color:#217346; display:block; margin-top:5px; text-decoration:none;">
                                            <i class="fas fa-file"></i> ${aluno.resposta_arquivo.length > 20 ? aluno.resposta_arquivo.substring(0,15)+'...'+aluno.resposta_arquivo.split('.').pop() : aluno.resposta_arquivo}
                                        </a>
                                    </div>
                                ` : ''}
                                
                                ${aluno.nota ? `
                                    <div style="margin-top:8px; text-align:right;">
                                        <span style="background:rgba(33,115,70,0.1); color:#217346; padding:4px 12px; border-radius:15px;">
                                            Nota: ${aluno.nota}
                                        </span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    });
                    
                    html += `</div></div>`;
                    
                    document.getElementById('tarefaDetalhes').innerHTML = html;
                    document.getElementById('verTarefaModal').style.display = 'flex';
                });
        }
        
        function avaliarTarefa(id) {
    fetch(`/dashboard/tarefas/${id}`)
        .then(response => response.json())
        .then(data => {
            let html = `
                <h3 style="color:#fff; margin-bottom:25px; text-align:center; font-size:1.3rem; border-bottom:1px solid #333; padding-bottom:10px;">
                    ${escapeHtml(data.tarefa.titulo)}
                </h3>
                <div style="max-height:500px; overflow-y:auto; padding-right:5px;">
            `;
            
            data.alunos.forEach(aluno => {
                let statusText = '';
                let statusColor = '';
                let statusBg = '';
                
                if (aluno.status_tarefa === 'CONCLUIDA') {
                    statusText = 'CONCLUÍDA';
                    statusColor = '#217346';
                    statusBg = 'rgba(33,115,70,0.1)';
                } else if (aluno.status_tarefa === 'ENTREGUE') {
                    statusText = 'AGUARDANDO CORREÇÃO';
                    statusColor = '#217346';
                    statusBg = 'rgba(33,115,70,0.1)';
                } else if (aluno.status_tarefa === 'DEVOLVIDA') {
                    statusText = 'DEVOLVIDA';
                    statusColor = '#ffa500';
                    statusBg = 'rgba(255,165,0,0.1)';
                } else if (aluno.status_tarefa === 'ATRASADA') {
                    statusText = 'ATRASADA';
                    statusColor = '#ff0101';
                    statusBg = 'rgba(255,1,1,0.1)';
                } else {
                    statusText = 'PENDENTE';
                    statusColor = '#d4a017';
                    statusBg = 'rgba(212,160,23,0.1)';
                }
                
                function abreviarNomeArquivo(nomeArquivo) {
                    if (!nomeArquivo) return '';
                    if (nomeArquivo.length <= 25) return nomeArquivo;
                    const partes = nomeArquivo.split('.');
                    const ext = partes.pop();
                    const nome = partes.join('.');
                    return nome.substring(0, 15) + '...' + ext;
                }
                
                html += `
                    <div style="background: #111111; border: 2px solid #2e3134; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <span style="color: #fff; font-size: 1.1rem;">${escapeHtml(aluno.nome)}</span>
                                <span style="color: #888; font-size: 0.8rem; margin-left: 10px;">${escapeHtml(aluno.ano_escolar)}</span>
                            </div>
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 15px; border-radius: 20px; font-size: 0.75rem; border: 2px solid ${statusColor};">
                                ${statusText}
                            </span>
                        </div>
                        
                        ${aluno.data_entrega_aluno ? `
                            <div style="background: #151515; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-clock" style="color: #217346; font-size: 0.9rem;"></i>
                                    <span style="color: #888; font-size: 0.85rem;">
                                        Entregue em: <strong style="color: #fff;">${new Date(aluno.data_entrega_aluno).toLocaleString('pt-BR')}</strong>
                                    </span>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${aluno.resposta_texto ? `
                            <div style="background: #151515; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                                <span style="color: #888; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                                    <i class="fas fa-quote-right" style="margin-right: 5px;"></i>RESPOSTA DO ALUNO:
                                </span>
                                <p style="color: #fff; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; margin: 0;">
                                    ${escapeHtml(aluno.resposta_texto)}
                                </p>
                            </div>
                        ` : ''}
                        
                        ${aluno.resposta_arquivo ? `
                            <div style="background: #151515; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
                                <span style="color: #888; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                                    <i class="fas fa-paperclip" style="margin-right: 5px;"></i>ARQUIVO ANEXADO:
                                </span>
                                <a href="/uploads/${escapeHtml(aluno.resposta_arquivo)}" target="_blank" style="color: #217346; text-decoration: none; display: flex; align-items: center; gap: 8px; background: #151515; padding: 8px 12px; border-radius: 6px; border: 2px solid #217346;">
                                    <i class="fas fa-file-download" style="font-size: 1rem;"></i>
                                    <span style="word-wrap: break-word; font-size: 0.85rem;">${abreviarNomeArquivo(aluno.resposta_arquivo)}</span>
                                </a>
                            </div>
                        ` : ''}
                        
                        ${aluno.status_tarefa === 'ENTREGUE' || aluno.status_tarefa === 'DEVOLVIDA' ? `
                            <div style="display: flex; gap: 10px; margin-top: 15px;">
                                <button data-aluno-nome="${escapeHtml(aluno.nome)}" onclick="mostrarAvaliacao(${data.tarefa.id}, ${aluno.id})" style="flex: 1; background: transparent; border: 2px solid #217346; color: #217346; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-star"></i> AVALIAR
                                </button>
                                <button data-aluno-nome="${escapeHtml(aluno.nome)}" onclick="devolverTarefa(${data.tarefa.id}, ${aluno.id}, this.dataset.alunoNome)" style="flex: 1; background: transparent; border: 2px solid #ffa500; color: #ffa500; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-undo-alt"></i> DEVOLVER
                                </button>
                            </div>
                        ` : ''}
                        
                        <div id="avaliacao-${aluno.id}" style="display: none; margin-top: 15px; padding: 15px; background: #151515; border-radius: 8px;">
                            <h4 style="color:#fff; margin-bottom:15px; font-size:1rem;">Avaliar: ${escapeHtml(aluno.nome)}</h4>
                            <input type="number" id="nota-${aluno.id}" placeholder="Nota (0-10)" min="0" max="10" step="0.1" style="width: 100%; padding: 12px; background: #151515; border: 2px solid #333; border-radius: 6px; color: #fff; font-size: 1rem; margin-bottom: 10px;">
                            <textarea id="feedback-${aluno.id}" placeholder="Feedback para o aluno..." style="width: 100%; padding: 12px; background: #151515; border: 2px solid #333; border-radius: 6px; color: #fff; font-size: 0.9rem; min-height: 80px; margin-bottom: 10px; resize: vertical;"></textarea>
                            <button onclick="salvarAvaliacao(${data.tarefa.id}, ${aluno.id})" style="width: 100%; background: #217346; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.3s;">
                                <i class="fas fa-save"></i> SALVAR AVALIAÇÃO
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div>`;
            
            document.getElementById('avaliarTarefaConteudo').innerHTML = html;
            document.getElementById('avaliarTarefaModal').style.display = 'flex';
        });
}
        
        function mostrarAvaliacao(tarefaId, alunoId, alunoNome) {
            const avaliacaoDiv = document.getElementById(`avaliacao-${alunoId}`);
            if (avaliacaoDiv.style.display === 'none' || avaliacaoDiv.style.display === '') {
                avaliacaoDiv.style.display = 'block';
            } else {
                avaliacaoDiv.style.display = 'none';
            }
        }
        
        function salvarAvaliacao(tarefaId, alunoId) {
            const nota = document.getElementById(`nota-${alunoId}`).value;
            const feedback = document.getElementById(`feedback-${alunoId}`).value;
            
            if (!nota || nota < 0 || nota > 10) {
                alert('Por favor, insira uma nota válida entre 0 e 10');
                return;
            }
            
            fetch('/dashboard/tarefas/avaliar-aluno', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: JSON.stringify({
                    tarefa_id: tarefaId,
                    aluno_id: alunoId,
                    nota: parseFloat(nota),
                    feedback: feedback
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Avaliação salva com sucesso!');
                    if (data.virou_competencia) {
                        alert('Esta nota também foi registrada como competência para o aluno!');
                    }
                    location.reload();
                } else {
                    alert('Erro ao salvar avaliação');
                }
            });
        }
        
        function devolverTarefa(tarefaId, alunoId, alunoNome) {
            if (confirm(`Deseja devolver a tarefa para ${alunoNome} fazer correções?`)) {
                fetch('/dashboard/tarefas/devolver-aluno', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                    },
                    body: JSON.stringify({
                        tarefa_id: tarefaId,
                        aluno_id: alunoId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Tarefa devolvida para correção!');
                        location.reload();
                    } else {
                        alert('Erro ao devolver tarefa');
                    }
                });
            }
        }
        
        function editarTarefa(id) {
            fetch(`/dashboard/tarefas/${id}`)
                .then(response => response.json())
                .then(data => {
                    document.getElementById('editTitulo').value = data.tarefa.titulo;
                    document.getElementById('editDescricao').value = data.tarefa.descricao || '';
                    document.getElementById('editDataEntrega').value = data.tarefa.data_entrega ? data.tarefa.data_entrega.split('T')[0] : '';
                    document.getElementById('editPrioridade').value = data.tarefa.prioridade;
                    document.getElementById('editStatus').value = data.tarefa.status;
                    
                    const form = document.getElementById('editarTarefaForm');
                    form.action = `/dashboard/tarefas/editar/${id}`;
                    
                    document.getElementById('editarTarefaModal').style.display = 'flex';
                });
        }
        
        function excluirTarefa(id) {
            if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                const form = document.getElementById('excluirTarefaForm');
                form.action = `/dashboard/tarefas/excluir/${id}`;
                form.submit();
            }
        }
        
        window.onclick = function(event) {
            if (event.target.classList.contains('modal-overlay')) {
                event.target.style.display = 'none';
            }
        }

        document.getElementById('turmaSelect')?.addEventListener('change', function() {
            const turmaSelecionada = this.value;
            const alunosItems = document.querySelectorAll('#novaTarefaModal .aluno-tarefa-item');
            
            alunosItems.forEach(item => {
                const alunoTurma = item.getAttribute('data-turma');
                if (turmaSelecionada === '' || alunoTurma === turmaSelecionada) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                    const checkbox = item.querySelector('.aluno-checkbox');
                    if (checkbox) checkbox.checked = false;
                }
            });
            
            document.getElementById('selecionarTodosAlunos').checked = false;
        });

function abrirModalNovaTarefa() {
    document.getElementById('novaTarefaModal').style.display = 'flex';
    document.getElementById('turmaSelect').value = '';
    document.querySelectorAll('#novaTarefaModal .aluno-tarefa-item').forEach(item => {
        item.style.display = 'flex';
    });
}

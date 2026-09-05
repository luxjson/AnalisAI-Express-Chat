function getPageData(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (error) {
        console.error('Falha ao ler dados da página.');
        return null;
    }
}

function openLoadingModal() {
    document.getElementById('loadingModal').style.display = 'flex';
    document.getElementById('loadingBar').style.width = '0%';
    document.getElementById('loadingStatus').innerText = '0% concluído';
}

function closeLoadingModal() {
    document.getElementById('loadingModal').style.display = 'none';
}

function updateLoadingBar(percent, texto) {
    document.getElementById('loadingBar').style.width = percent + '%';
    document.getElementById('loadingStatus').innerText = texto || percent + '% concluído';
}

        function openErrorModal(titulo, mensagem, detalhe) {
            document.getElementById('errorTitulo').innerText = titulo || 'ERRO';
            document.getElementById('errorMensagem').innerText = mensagem || 'Ocorreu um erro inesperado';
            document.getElementById('errorDetalhe').innerText = detalhe || '';
            document.getElementById('errorModal').style.display = 'flex';
        }

        function closeErrorModal() {
            document.getElementById('errorModal').style.display = 'none';
        }
        
        function openImportModal() {
            document.getElementById('importModal').style.display = 'flex';
            document.getElementById('fileInput').value = '';
            document.getElementById('fileName').innerText = '';
        }

        function closeImportModal() {
            document.getElementById('importModal').style.display = 'none';
        }

        document.getElementById('fileInput')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            document.getElementById('fileName').innerText = file ? `📄 ${file.name}` : '';
        });

        const dropArea = document.querySelector('.file-drop-area');
        if (dropArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            dropArea.addEventListener('drop', function(e) {
                const file = e.dataTransfer.files[0];
                document.getElementById('fileInput').files = e.dataTransfer.files;
                document.getElementById('fileName').innerText = file ? `📄 ${file.name}` : '';
            });
        }

        function openPreviewModal() {
            document.getElementById('previewImportModal').style.display = 'flex';
        }

        function closePreviewModal() {
            document.getElementById('previewImportModal').style.display = 'none';
        }

        document.getElementById('fileInput')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            document.getElementById('fileName').innerText = file ? `📄 ${file.name}` : '';
        });

        let alunosParaImportar = [];

        async function importarPlanilha() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        openErrorModal('ERRO', 'Selecione um arquivo primeiro!', '');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const primeiraAba = workbook.SheetNames[0];
            const planilha = workbook.Sheets[primeiraAba];
            
            const linhas = XLSX.utils.sheet_to_json(planilha, { header: 1 });
            
            let linhaAlunos = -1;
            for (let i = 0; i < Math.min(30, linhas.length); i++) {
                const linha = linhas[i];
                if (linha && linha[0] === 'ID' && linha[1] === 'ALUNO') {
                    linhaAlunos = i;
                    break;
                }
            }
            
            if (linhaAlunos === -1) {
                openErrorModal('FORMATO INVÁLIDO', 'Formato de planilha não reconhecido. Use o modelo baixado.', '');
                return;
            }
            
            alunosParaImportar = [];
            const anosValidos = ['1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL'];
            
            for (let i = linhaAlunos + 1; i < linhas.length; i++) {
                const linha = linhas[i];
                if (!linha || linha.length === 0) continue;
                
                const primeiraCelula = String(linha[0] || '').toUpperCase();
                if (primeiraCelula.includes('HISTÓRICO') || primeiraCelula.includes('INSTRUÇÕES')) {
                    break;
                }
                
                const nome = String(linha[1] || '').trim().toUpperCase();
                if (!nome || nome.length < 2 || nome === 'ALUNO') continue;
                
                const anoEscolar = String(linha[2] || '').trim();
                
                if (anoEscolar && !anosValidos.includes(anoEscolar)) {
                    openErrorModal('ANO ESCOLAR INVÁLIDO', `"${anoEscolar}" não é permitido`, 'Use: 1º MÉDIO, 2º MÉDIO, 3º MÉDIO, 9º FUNDAMENTAL');
                    return;
                }
                
                const idade = parseInt(linha[3]) || 15;
                if (idade < 10 || idade > 20) {
                    openErrorModal('IDADE INVÁLIDA', `Idade ${idade} inválida`, 'A idade deve estar entre 10 e 20 anos');
                    return;
                }
                
                let presenca = 100;
                if (linha[5]) {
                    const presencaStr = String(linha[5]).replace('%', '').trim();
                    presenca = parseInt(presencaStr) || 100;
                    if (presenca < 0 || presenca > 100) {
                        openErrorModal('PRESENÇA INVÁLIDA', `Presença ${presenca}% inválida`, 'A presença deve estar entre 0% e 100%');
                        return;
                    }
                }
                
                const competenciasStr = String(linha[7] || '').trim();
                const competencias = [];
                
                if (competenciasStr && competenciasStr !== 'Sem competências') {
                    const partes = competenciasStr.split(';').slice(0, 10);
                    for (const parte of partes) {
                        const compParts = parte.split(':');
                        if (compParts.length >= 2) {
                            const nomeComp = compParts[0].trim().substring(0, 50);
                            const notaComp = parseFloat(compParts[1].trim()) || 0;
                            if (nomeComp && notaComp > 0 && notaComp <= 10) {
                                competencias.push({
                                    nome: nomeComp,
                                    nota: Math.min(10, Math.max(0, notaComp))
                                });
                            }
                        }
                    }
                }
                
                if (competencias.length > 10) {
                    competencias.length = 10;
                }
                
                alunosParaImportar.push({
                    nome: nome.substring(0, 100),
                    ano_escolar: anoEscolar,
                    idade: idade,
                    presenca: presenca,
                    competencias: competencias
                });
            }
            
            if (alunosParaImportar.length === 0) {
                openErrorModal('NENHUM ALUNO', 'Nenhum aluno encontrado na planilha!', '');
                return;
            }
            
            if (alunosParaImportar.length > 100) {
                alunosParaImportar.length = 100;
            }
            
            let previewHtml = '';
            alunosParaImportar.slice(0, 5).forEach(aluno => {
                previewHtml += `<tr>
                    <td style="padding: 8px; border-bottom: 1px solid #222; color: #fff;">${escapeHtml(aluno.nome)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #222; color: #888;">${escapeHtml(aluno.ano_escolar)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #222; color: #888;">${aluno.competencias.length}</td>
                </tr>`;
            });
            
            if (alunosParaImportar.length > 5) {
                previewHtml += `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #888;">... mais ${alunosParaImportar.length - 5} alunos</td></tr>`;
            }
            
            document.getElementById('previewList').innerHTML = previewHtml;
            document.getElementById('previewCount').innerHTML = `${alunosParaImportar.length} alunos encontrados`;
            
            closeImportModal();
            openPreviewModal();
            
        } catch (erro) {
            console.error('Erro detalhado:', erro);
            openErrorModal('ERRO AO PROCESSAR', erro.message, '');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

async function confirmarImportacao() {
    if (alunosParaImportar.length === 0) return;
    
    closePreviewModal();
    openLoadingModal();
    
    updateLoadingBar(10, 'Preparando dados...');
    
    const response = await fetch('/dashboard/importar-dados-completos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunos: alunosParaImportar })
    });
    
    updateLoadingBar(70, 'Salvando no banco de dados...');
    
    const resultado = await response.json();
    
    if (resultado.sucesso) {
        updateLoadingBar(100, 'Importação concluída!');
        setTimeout(() => {
            closeLoadingModal();
            if (resultado.credenciais && resultado.credenciais.length > 0) {
                abrirModalCredenciais(resultado.credenciais);
            } else {
                location.reload();
            }
        }, 500);
    } else {
        closeLoadingModal();
        openErrorModal('ERRO NA IMPORTAÇÃO', resultado.erro, '');
    }
}

function abrirModalCredenciais(credenciais) {
    const modal = document.getElementById('credenciaisModal');
    const lista = document.getElementById('credenciaisLista');
    let html = `
        <div style="max-height: 400px; overflow-y: auto; margin: 20px 0;">
            <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 10px; text-align: left; color: #888;">Nome</th>
                        <th style="padding: 10px; text-align: left; color: #888;">E-mail</th>
                        <th style="padding: 10px; text-align: left; color: #888;">Matrícula</th>
                        <th style="padding: 10px; text-align: left; color: #888;">Senha</th>
                    </tr>
                </thead>
                <tbody>
    `;
    credenciais.forEach(cred => {
        html += `
            <tr style="border-bottom: 1px solid #222;">
                <td style="padding: 10px; color: #fff;">${escapeHtml(cred.nome)}</td>
                <td style="padding: 10px; color: #ccc;">${escapeHtml(cred.email)}</td>
                <td style="padding: 10px; color: #ccc;">${escapeHtml(cred.matricula)}</td>
                <td style="padding: 10px; color: #ff0101; font-weight: bold;">${escapeHtml(cred.senha)}</td>
            </tr>
        `;
    });
    html += `
                </tbody>
            </table>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="fecharModalCredenciais()" class="btn-action-2" style="flex:1; justify-content:center;">Fechar</button>
            <button onclick="copiarCredenciais()" class="btn-action" style="flex:1; justify-content:center; border-color: #217346; color: #217346;">
                <i class="fas fa-copy"></i> Copiar Tudo
            </button>
        </div>
    `;
    lista.innerHTML = html;
    modal.style.display = 'flex';
}

function fecharModalCredenciais() {
    document.getElementById('credenciaisModal').style.display = 'none';
    location.reload();
}

function copiarCredenciais() {
    const linhas = document.querySelectorAll('#credenciaisLista tbody tr');
    let texto = '';
    linhas.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        texto += `${tds[0].textContent} | ${tds[1].textContent} | ${tds[2].textContent} | ${tds[3].textContent}\n`;
    });
    navigator.clipboard.writeText(texto).then(() => {
        alert('Credenciais copiadas para a área de transferência!');
    });
}

document.getElementById('competenciasSearchInput').addEventListener('keyup', function() {
            const searchTerm = this.value.toLowerCase();
            document.querySelectorAll(".competencia-card").forEach(card => {
                const studentName = card.getAttribute('data-aluno-nome') || '';
                card.style.display = studentName.includes(searchTerm) ? "" : "none";
            });
        });

        document.getElementById('chartSearchInput').addEventListener('keyup', function() {
            const searchTerm = this.value.toLowerCase();
            document.querySelectorAll(".chart-card").forEach(card => {
                const studentName = card.getAttribute('data-aluno-nome') || '';
                card.style.display = studentName.includes(searchTerm) ? "" : "none";
            });
        });

        function openExportModal() { document.getElementById('exportSuccessModal').style.display = 'flex'; }
        function closeExportModal() { document.getElementById('exportSuccessModal').style.display = 'none'; }
        function openFilter() { document.getElementById('filterModal').style.display = 'flex'; }
        function closeFilter() { document.getElementById('filterModal').style.display = 'none'; }
        function openAddModal() { document.getElementById('addAlunoModal').style.display = 'flex'; }
        function closeAddModal() { document.getElementById('addAlunoModal').style.display = 'none'; }
        
function openEditModal(id, nome, presenca) {
    fetch(`/dashboard/aluno-dados/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('Falha ao carregar dados');
            return response.json();
        })
        .then(data => {
            document.getElementById('editAlunoId').value = id;
            document.getElementById('editAlunoIdComp').value = id;
            document.getElementById('editNomeAluno').innerText = nome.toUpperCase();
            document.getElementById('editPresencaInput').value = presenca;
            const loginInfo = document.getElementById('loginInfo');
            if (loginInfo) {
                loginInfo.innerHTML = `
                    <div style="background: #151515; padding: 15px; border-radius: 12px; border: 1px solid #333; ">
                        <p style="color: #888; font-size: 0.7rem; text-transform: uppercase; margin-bottom: 12px;">Credenciais do Aluno</p>
                        <p style="color: #fff; margin-bottom: 10px; font-size: 0.9rem;">
                            <i class="fas fa-envelope" style="color: var(--primary-red); width: 20px;"></i>
                            <strong>E-mail:</strong> ${escapeHtml(data.email || 'Não cadastrado')}
                        </p>
                        <p style="color: #fff; margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-id-card" style="color: var(--primary-red); width: 20px;"></i>
                            <strong>Matrícula:</strong> ${escapeHtml(data.matricula || 'Não cadastrada')}
                        </p>
                        <div style="border-top: 1px solid #333; padding-top: 12px;">
                            <p style="color: #fff; margin-bottom: 8px; font-size: 0.9rem;">
                                <i class="fas fa-lock" style="color: var(--primary-red); width: 20px;"></i>
                                <strong>Senha:</strong> <span id="senhaAlunoValor">Não é possível recuperar a senha atual</span>
                            </p>
                            <small style="display:block;color:#777;line-height:1.4;margin-bottom:10px;">A senha atual é armazenada somente como hash. Gere uma nova senha abaixo para visualizar a nova credencial.</small>
                            <button type="button" class="btn-secondary-dash" style="width:100%;justify-content:center;" onclick="gerarNovaSenhaAluno('${id}')">
                                <i class="fas fa-key"></i> GERAR NOVA SENHA
                            </button>
                        </div>
                    </div>
                `;
            }
            carregarCompetencias(id);
            showEditTab('info');
            document.getElementById('editAlunoModal').style.display = 'flex';
        })
        .catch(error => {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados do aluno.');
        });
}

function gerarNovaSenhaAluno(id) {
    const token = document.querySelector('input[name="_csrf"]')?.value;
    if (!confirm('Gerar uma nova senha? A senha atual deixará de funcionar imediatamente.')) return;
    fetch(`/dashboard/gerar-senha-aluno/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-CSRF-Token': token } : {})
        },
        body: JSON.stringify({ _csrf: token })
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Erro ao gerar senha');
        const el = document.getElementById('senhaAlunoValor');
        if (el) {
            el.textContent = data.senha;
            el.style.color = '#fff';
            el.style.fontWeight = '700';
            el.style.letterSpacing = '1px';
        }
    })
    .catch(error => {
        console.error(error);
        alert(error.message || 'Erro ao gerar nova senha.');
    });
}

function showEditTab(tabName) {
    const contents = document.querySelectorAll('#editAlunoModal .tab-content');
    contents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    const buttons = document.querySelectorAll('#editAlunoModal .tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    const targetId = 'edit' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab';
    const activeContent = document.getElementById(targetId);
    
    if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
    }
    const activeBtn = document.getElementById('btn-tab-' + tabName);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

        function closeEditModal() { 
            document.getElementById('editAlunoModal').style.display = 'none'; 
        }



        function carregarCompetencias(alunoId) {
            fetch(`/dashboard/competencias-aluno/${alunoId}`)
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('competenciasListContainer');
                    if (data.length === 0) {
                        container.innerHTML = '<p style="color: #888; text-align: center;">Nenhuma competência registrada ainda.</p>';
                    } else {
                        let html = '';
                        data.forEach(comp => {
                            const notaClass = comp.nota >= 7 ? 'apto' : (comp.nota >= 5 ? 'desenvolvimento' : 'inapto');
                            html += `
                                <div class="competencia-edit-item">
                                    <div class="competencia-edit-info">
                                        <span class="competencia-edit-nome">${escapeHtml(comp.nome)}</span>
                                        ${comp.observacoes ? `<small style="color:#888">${escapeHtml(comp.observacoes)}</small>` : ''}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span class="competencia-edit-nota ${notaClass}">${parseFloat(comp.nota).toFixed(1)}</span>
                                        <button type="button" class="btn-delete-comp" onclick="deletarCompetencia(${comp.id})">
                                            <i class="ph-bold ph-trash" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                        });
                        container.innerHTML = html;
                    }
                })
                .catch(error => {
                    console.error('Erro:', error);
                    document.getElementById('competenciasListContainer').innerHTML = 
                        '<p style="color: #ff0101; text-align: center;">Erro ao carregar competências.</p>';
                });
        }

            async function deletarCompetencia(id) {
                if (!confirm('Remover esta competência?')) return;
                const response = await fetch(`/dashboard/deletar-competencia/${id}`, {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' }
                });
                if (response.ok) window.location.reload();
            }

        document.addEventListener("DOMContentLoaded", () => {
            const dataAlunos = getPageData('dashboard-edit-data') || [];
            
            dataAlunos.forEach(aluno => {
                const canvas = document.getElementById(`chart-${aluno.id}`);
                if (!canvas || !aluno.competencias || aluno.competencias.length === 0) return;
                
                const ctx = canvas.getContext('2d');
                const labels = aluno.competencias.map(c => c.nome.substring(0, 10));
                const valores = aluno.competencias.map(c => parseFloat(c.nota));

                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Nota',
                            data: valores,
                            backgroundColor: valores.map(v => 
                                v >= 7 ? 'rgba(0, 255, 0, 0.5)' : 
                                v >= 5 ? 'rgba(255, 255, 0, 0.5)' : 
                                'rgba(255, 0, 0, 0.5)'
                            ),
                            borderColor: '#ff0101',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                            x: { grid: { display: false }, ticks: { color: '#888', maxRotation: 45, minRotation: 45 } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            });
        });

        function applyFilter() {
            const selAno = document.getElementById('filterAno').value;
            const selStatus = document.getElementById('filterStatus').value;
            
            document.querySelectorAll("#alunosTableBody tr").forEach(row => {
                const ano = row.cells[2].textContent.trim();
                const status = row.cells[6].textContent.trim();
                row.style.display = ((selAno === "" || ano === selAno) && (selStatus === "" || status === selStatus)) ? "" : "none";
            });
            
            document.querySelectorAll(".chart-card, .competencia-card").forEach(card => {
                const nomeAluno = card.querySelector("h3")?.textContent.replace('ALUNO:', '').trim() || '';
                let encontrou = false;
                
                document.querySelectorAll("#alunosTableBody tr").forEach(row => {
                    if (row.style.display !== "none") {
                        const nomeTabela = row.cells[1].textContent.trim();
                        if (nomeTabela === nomeAluno) encontrou = true;
                    }
                });
                
                card.style.display = encontrou ? "" : "none";
            });
            
            closeFilter();
        }

        function clearFilters() {
            document.getElementById('filterAno').value = "";
            document.getElementById('filterStatus').value = "";
            document.querySelectorAll("#alunosTableBody tr, .chart-card, .competencia-card").forEach(el => el.style.display = "");
            closeFilter();
        }

        document.getElementById('searchInput').addEventListener('keyup', function() {
            const filter = this.value.toUpperCase();
            document.querySelectorAll("#alunosTableBody tr").forEach(row => {
                row.style.display = row.cells[1].textContent.toUpperCase().includes(filter) ? "" : "none";
            });
        });

        async function confirmDelete(id, nome) {
            if (confirm(`Remover aluno ${nome}?`)) {
                const response = await fetch(`/dashboard/delete-aluno/${id}`, {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' }
                });
                if (response.ok) window.location.reload();
            }
        }

        async function exportarTabelaParaExcel() {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Relatório AnalisAI');
            const dataAlunos = getPageData('dashboard-edit-data') || [];

            worksheet.columns = [
                { key: 'A', width: 10 },
                { key: 'B', width: 20 },
                { key: 'C', width: 20 },
                { key: 'D', width: 24 },
                { key: 'E', width: 12 },
                { key: 'F', width: 12 },
                { key: 'G', width: 25 },
                { key: 'H', width: 120 }
            ];

            try {
                const response = await fetch('/images/xls-logo.png');
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const logoId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
                worksheet.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 3, row: 6 } });
                
                worksheet.mergeCells('D2:G4');
                const titleCell = worksheet.getCell('D2');
                titleCell.value = 'RELATÓRIO GERAL DE DESEMPENHO POR COMPETÊNCIA';
                titleCell.font = { size: 16, bold: true, color: { argb: 'FFFF0101' } };
                titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            } catch (e) { console.log("Erro logo"); }

            const headerRow = worksheet.getRow(8);
            headerRow.values = ['ID', 'ALUNO', 'ANO ESCOLAR', 'IDADE', 'MÉDIA', 'PRESENÇA', 'NÍVEL', 'COMPETÊNCIAS'];
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0101' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            dataAlunos.forEach((aluno, index) => {
                let mediaCompetencias = 0;
                let competenciasStr = '';
                
                if (aluno.competencias && aluno.competencias.length > 0) {
                    const soma = aluno.competencias.reduce((acc, comp) => acc + parseFloat(comp.nota), 0);
                    mediaCompetencias = (soma / aluno.competencias.length).toFixed(1);
                    competenciasStr = aluno.competencias.map(comp => 
                        `${escapeHtml(comp.nome)}: ${parseFloat(comp.nota).toFixed(1)}`
                    ).join('; ');
                } else {
                    mediaCompetencias = '0.0';
                    competenciasStr = 'Sem competências';
                }

                let nivel = 'EM DESENVOLVIMENTO';
                if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
                    nivel = 'APTO';
                } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
                    nivel = 'INAPTO';
                }

                const row = worksheet.getRow(9 + index);
                row.values = [aluno.id, aluno.nome, aluno.ano_escolar, aluno.idade, mediaCompetencias, aluno.presenca + '%', nivel, competenciasStr];

                row.eachCell((cell, colNum) => {
                    cell.alignment = { horizontal: colNum === 2 ? 'left' : 'center', vertical: 'middle' };
                });
            });

            let currentRow = 9 + dataAlunos.length + 2;

            dataAlunos.forEach(aluno => {
                const titleRow = worksheet.getRow(currentRow);
                titleRow.getCell(1).value = `HISTÓRICO INDIVIDUAL: ${aluno.nome.toUpperCase()}`;
                titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0101' } };
                worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
                currentRow++;

                const compHeaderRow = worksheet.getRow(currentRow);
                compHeaderRow.getCell(2).value = 'COMPETÊNCIAS';
                compHeaderRow.getCell(7).value = 'NOTA';
                compHeaderRow.getCell(2).font = { bold: true };
                compHeaderRow.getCell(7).font = { bold: true };
                compHeaderRow.getCell(2).alignment = { horizontal: 'left' };
                compHeaderRow.getCell(7).alignment = { horizontal: 'center' };
                currentRow++;

                if (aluno.competencias && aluno.competencias.length > 0) {
                    aluno.competencias.forEach(comp => {
                        const compRow = worksheet.getRow(currentRow);
                        compRow.getCell(2).value = comp.nome;
                        compRow.getCell(3).value = comp.observacoes || 'Avaliação inicial';
                        compRow.getCell(7).value = parseFloat(comp.nota).toFixed(1);
                        
                        compRow.getCell(2).alignment = { horizontal: 'left' };
                        compRow.getCell(3).alignment = { horizontal: 'left' };
                        compRow.getCell(7).alignment = { horizontal: 'center' };
                        compRow.getCell(7).font = { bold: true };
                        
                        worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
                        currentRow++;
                    });
                } else {
                    const emptyRow = worksheet.getRow(currentRow);
                    emptyRow.getCell(2).value = 'Sem competências';
                    emptyRow.getCell(3).value = '-';
                    emptyRow.getCell(7).value = '-';
                    worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
                    currentRow++;
                }

                currentRow += 2;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Relatorio_Completo_AnalisAI.xlsx`);
            openExportModal();
        }
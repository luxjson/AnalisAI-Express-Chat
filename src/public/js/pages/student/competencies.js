function getPageData(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (error) {
        console.error('Falha ao ler dados da página.');
        return null;
    }
}

document.addEventListener("DOMContentLoaded", function() {
            const ctx = document.getElementById('competenciasChart').getContext('2d');
            const data = getPageData('aluno-competencias-data') || [];
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(c => c.nome),
                    datasets: [{
                        data: data.map(c => parseFloat(c.nota) || 0),
                        backgroundColor: data.map(c => {
                            const v = parseFloat(c.nota);
                            return v >= 7 ? '#217346' : (v >= 5 ? '#d4a017' : '#ff0101');
                        }),
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                        x: { grid: { display: false }, ticks: { color: '#888' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        });

        function aplicarFiltros() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const cat = document.getElementById('categoriaFilter').value;
            const nivel = document.getElementById('nivelFilter').value;
            const cards = document.querySelectorAll('.stats-card[data-nome]');

            cards.forEach(card => {
                const matchSearch = card.dataset.nome.includes(search);
                const matchCat = !cat || card.dataset.categoria === cat;
                const matchNivel = !nivel || card.dataset.nivel === nivel;
                card.style.display = (matchSearch && matchCat && matchNivel) ? '' : 'none';
            });
        }

        function limparFiltros() {
            document.getElementById('searchInput').value = '';
            document.getElementById('categoriaFilter').value = '';
            document.getElementById('nivelFilter').value = '';
            document.querySelectorAll('.stats-card[data-nome]').forEach(c => c.style.display = '');
        }

        function ordenarCompetencias() {
            const ordem = document.getElementById('ordenarSelect').value;
            const grid = document.getElementById('competenciasGrid');
            const cards = Array.from(grid.querySelectorAll('.stats-card[data-nome]'));

            cards.sort((a, b) => {
                if (ordem === 'nota_desc') return b.dataset.nota - a.dataset.nota;
                if (ordem === 'nome_asc') return a.dataset.nome.localeCompare(b.dataset.nome);
                return new Date(b.dataset.data) - new Date(a.dataset.data);
            });

            cards.forEach(c => grid.appendChild(c));
        }

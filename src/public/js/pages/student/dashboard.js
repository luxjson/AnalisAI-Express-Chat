function getPageData(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (error) {
        console.error('Falha ao ler dados da página.');
        return null;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    const labels = getPageData('aluno-dashboard-data')?.labels || [];
    const valores = getPageData('aluno-dashboard-data')?.valores || [];
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Seu Desempenho',
                data: valores,
                backgroundColor: 'rgba(33, 115, 70, 0.2)', 
                borderColor: '#217346', 
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#217346',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                r: {
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        circular: true
                    },
                    ticks: {
                        display: false,
                        maxTicksLimit: 5
                    },
                    pointLabels: {
                        color: '#aaa', 
                        font: {
                            family: 'helvetica',
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    suggestedMin: 0,
                    suggestedMax: 10
                }
            }
        }
    });
});

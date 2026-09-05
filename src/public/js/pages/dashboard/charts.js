function getPageData(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (error) {
        console.error('Falha ao ler dados da página.');
        return null;
    }
}

const stats = getPageData('dashboard-graficos-data') || {};

        function criarGraficos() {
            if (stats.total > 0) {
                stats.desenvolvimento = stats.total - stats.apto - stats.inapto;

                const commonOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                };

                const barOptions = {
                    ...commonOptions,
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            max: 10,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#888', stepSize: 2 }
                        },
                        x: { 
                            grid: { display: false },
                            ticks: { color: '#888' }
                        }
                    }
                };

                new Chart(document.getElementById('chartAptos'), {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [stats.apto, stats.total - stats.apto],
                            backgroundColor: ['#217346', '#151515'],
                            borderWidth: 0,
                            cutout: '75%',
                            borderRadius: 6
                        }]
                    },
                    options: commonOptions
                });

                new Chart(document.getElementById('chartInaptos'), {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [stats.inapto, stats.total - stats.inapto],
                            backgroundColor: ['#ff0101', '#151515'],
                            borderWidth: 0,
                            cutout: '75%',
                            borderRadius: 6
                        }]
                    },
                    options: commonOptions
                });

                new Chart(document.getElementById('chartDesenvolvimento'), {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [stats.desenvolvimento, stats.total - stats.desenvolvimento],
                            backgroundColor: ['#d4a017', '#151515'],
                            borderWidth: 0,
                            cutout: '75%',
                            borderRadius: 6
                        }]
                    },
                    options: commonOptions
                });

                if (document.getElementById('chartMedio')) {
                    new Chart(document.getElementById('chartMedio'), {
                        type: 'bar',
                        data: {
                            labels: ['MÉDIA GERAL'],
                            datasets: [{
                                data: [stats.mediaMedio],
                                backgroundColor: 'rgba(255, 1, 1, 0.3)',
                                borderColor: '#ff0101',
                                borderWidth: 2,
                                borderRadius: 8,
                                barPercentage: 0.4,
                                categoryPercentage: 0.6
                            }]
                        },
                        options: barOptions
                    });
                }

                if (document.getElementById('chartFundamental')) {
                    new Chart(document.getElementById('chartFundamental'), {
                        type: 'bar',
                        data: {
                            labels: ['MÉDIA GERAL'],
                            datasets: [{
                                data: [stats.mediaFundamental],
                                backgroundColor: 'rgba(255, 1, 1, 0.3)',
                                borderColor: '#ff0101',
                                borderWidth: 2,
                                borderRadius: 8,
                                barPercentage: 0.4,
                                categoryPercentage: 0.6
                            }]
                        },
                        options: barOptions
                    });
                }
            }
        }

        function atualizarGraficos() {
            window.location.reload();
        }

        document.addEventListener('DOMContentLoaded', criarGraficos);

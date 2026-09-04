function showRanking(tipo) {
            document.querySelectorAll('.ranking-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.ranking-content').forEach(content => content.classList.remove('active'));
            if (tipo === 'geral') {
                document.querySelectorAll('.ranking-tab')[0].classList.add('active');
                document.getElementById('rankingGeral').classList.add('active');
            } else if (tipo === 'medio') {
                document.querySelectorAll('.ranking-tab')[1].classList.add('active');
                document.getElementById('rankingMedio').classList.add('active');
            } else {
                document.querySelectorAll('.ranking-tab')[2].classList.add('active');
                document.getElementById('rankingFundamental').classList.add('active');
            }
        }

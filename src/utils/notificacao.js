const db = require('../db');

async function criarNotificacao(tipo, usuarioId, alunoId, titulo, mensagem, link, icone = 'fas fa-bell', cor = '#ff0101') {
    try {
        await db.query(
            `INSERT INTO notificacoes (usuario_id, aluno_id, tipo, titulo, mensagem, link, icone, cor) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [usuarioId || null, alunoId || null, tipo, titulo, mensagem, link, icone, cor]
        );
    } catch (err) {
        console.error('Erro ao criar notificação:', err);
    }
}

module.exports = { criarNotificacao };
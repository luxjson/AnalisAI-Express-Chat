const db = require('../db');

class Tarefa {
    static async findAllWithStats(turmaFilter = '', statusFilter = '') {
        let query = `
            SELECT 
                t.*,
                u.nome as professor_nome,
                COUNT(ta.id) as total_alunos,
                COUNT(CASE WHEN ta.status = 'CONCLUIDA' THEN 1 END) as concluidas,
                COUNT(CASE WHEN ta.status = 'ENTREGUE' THEN 1 END) as entregues,
                COUNT(CASE WHEN ta.status = 'DEVOLVIDA' THEN 1 END) as devolvidas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 1 END) as atrasadas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega >= CURRENT_DATE THEN 1 END) as pendentes
            FROM tarefas t
            LEFT JOIN usuarios u ON t.criado_por = u.id
            LEFT JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
            WHERE 1=1
        `;
        const params = [];
        if (turmaFilter) {
            params.push(turmaFilter);
            query += ` AND t.turma = $${params.length}`;
        }
        if (statusFilter) {
            params.push(statusFilter);
            query += ` AND t.status = $${params.length}`;
        }
        query += ` GROUP BY t.id, u.nome ORDER BY 
                    CASE 
                        WHEN t.status = 'ATIVA' THEN 1
                        ELSE 2
                    END,
                    t.data_criacao DESC`;
        const result = await db.query(query, params);
        return result.rows;
    }

    static async getStats() {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
                COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
                (
                    SELECT COUNT(*) 
                    FROM tarefas_alunos 
                    WHERE status = 'ENTREGUE'
                ) as aguardando_correcao
            FROM tarefas
        `);
        return result.rows[0];
    }

    static async create(titulo, descricao, turma, data_entrega, prioridade, competencia_id, criado_por) {
        const result = await db.query(
            `INSERT INTO tarefas (titulo, descricao, turma, data_entrega, prioridade, competencia_id, criado_por, data_atualizacao) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id`,
            [titulo, descricao, turma, data_entrega || null, prioridade || 'MEDIA', competencia_id || null, criado_por]
        );
        return result.rows[0].id;
    }

    static async findById(id) {
        const result = await db.query(`
            SELECT 
                t.*,
                c.nome as competencia_nome,
                u.nome as professor_nome
            FROM tarefas t
            LEFT JOIN competencias c ON t.competencia_id = c.id
            LEFT JOIN usuarios u ON t.criado_por = u.id
            WHERE t.id = $1
        `, [id]);
        return result.rows[0];
    }

    static async getAlunosComStatus(tarefaId, turma) {
        const result = await db.query(`
            SELECT 
                a.id,
                a.nome,
                a.ano_escolar,
                COALESCE(ta.status, 'PENDENTE') as status_tarefa,
                ta.nota,
                ta.feedback,
                ta.resposta_texto,
                ta.resposta_arquivo,
                ta.data_entrega as data_entrega_aluno,
                ta.data_avaliacao,
                TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada
            FROM alunos a
            LEFT JOIN tarefas_alunos ta ON a.id = ta.aluno_id AND ta.tarefa_id = $1
            WHERE a.ano_escolar = $2
            ORDER BY 
                CASE 
                    WHEN ta.status = 'ENTREGUE' THEN 1
                    WHEN ta.status = 'DEVOLVIDA' THEN 2
                    WHEN ta.status = 'PENDENTE' THEN 3
                    ELSE 4
                END,
                a.nome ASC
        `, [tarefaId, turma]);
        return result.rows;
    }

    static async update(id, titulo, descricao, data_entrega, prioridade, status) {
        await db.query(
            `UPDATE tarefas 
             SET titulo = $1, descricao = $2, data_entrega = $3, prioridade = $4, status = $5, data_atualizacao = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [titulo, descricao, data_entrega || null, prioridade, status, id]
        );
    }

    static async delete(id) {
        await db.query('DELETE FROM tarefas WHERE id = $1', [id]);
    }

    static async getAlunosByTurma(turma) {
        const result = await db.query('SELECT id FROM alunos WHERE ano_escolar = $1', [turma]);
        return result.rows;
    }

    static async atribuirParaAluno(tarefaId, alunoId, status = 'PENDENTE') {
        await db.query(
            `INSERT INTO tarefas_alunos (tarefa_id, aluno_id, status) VALUES ($1, $2, $3)`,
            [tarefaId, alunoId, status]
        );
    }

    static async getAlunosTarefa(tarefaId) {
        const result = await db.query(
            `SELECT aluno_id, status FROM tarefas_alunos WHERE tarefa_id = $1`,
            [tarefaId]
        );
        return result.rows;
    }
}

module.exports = Tarefa;
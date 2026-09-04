const db = require('../db');

class Competencia {
    static async findAll() {
        const result = await db.query(`
            SELECT id, nome, descricao, categoria
            FROM competencias 
            ORDER BY id ASC
        `);
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query('SELECT * FROM competencias WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async getAlunoCompetencias(alunoId) {
        const result = await db.query(`
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada,
                TO_CHAR(ac.data_registro, 'HH24:MI') as hora_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        return result.rows;
    }

    static async getAlunoCompetenciasStats(alunoId) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE nota >= 7) as aptas,
                COUNT(*) FILTER (WHERE nota >= 5 AND nota < 7) as desenvolvimento,
                COUNT(*) FILTER (WHERE nota < 5) as inaptas,
                COALESCE(AVG(nota), 0) as media_geral
            FROM aluno_competencias
            WHERE aluno_id = $1
        `, [alunoId]);
        return result.rows[0];
    }

    static async addAlunoCompetencia(alunoId, competenciaId, nota, observacoes) {
        const result = await db.query(
            `INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) 
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [alunoId, competenciaId, nota, observacoes || null]
        );
        return result.rows[0].id;
    }

    static async deleteAlunoCompetencia(id) {
        await db.query('DELETE FROM aluno_competencias WHERE id = $1', [id]);
    }

    static async updateAlunoNotaMedia(alunoId) {
        const media = await db.query(
            'SELECT AVG(nota) as media FROM aluno_competencias WHERE aluno_id = $1',
            [alunoId]
        );
        if (media.rows[0].media) {
            await db.query('UPDATE alunos SET nota = $1 WHERE id = $2', [media.rows[0].media, alunoId]);
        }
    }

    static async getCategoriasDesempenho(alunoId) {
        const competencias = await this.getAlunoCompetencias(alunoId);
        const categoriasMap = new Map();
        competencias.forEach(comp => {
            if (!categoriasMap.has(comp.categoria)) {
                categoriasMap.set(comp.categoria, {
                    categoria: comp.categoria,
                    soma: 0,
                    count: 0,
                    media: 0
                });
            }
            const cat = categoriasMap.get(comp.categoria);
            cat.soma += parseFloat(comp.nota);
            cat.count++;
            cat.media = (cat.soma / cat.count) * 10;
        });
        return Array.from(categoriasMap.values());
    }

    static async getHistoricoEvolucao(alunoId) {
        const result = await db.query(`
            SELECT 
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data,
                COUNT(*) as total_avaliacoes,
                COALESCE(AVG(ac.nota), 0) as media_dia
            FROM aluno_competencias ac
            WHERE ac.aluno_id = $1
            GROUP BY TO_CHAR(ac.data_registro, 'DD/MM/YYYY')
            ORDER BY data DESC
        `, [alunoId]);
        return result.rows;
    }

    static async getAlunoCompetenciasSimplificadas(alunoId) {
        const result = await db.query(`
            SELECT 
                ac.*, 
                c.nome, 
                c.descricao as competencia_desc,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        return result.rows;
    }
}

module.exports = Competencia;
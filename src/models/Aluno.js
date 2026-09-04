const db = require('../db');

class Aluno {
    static async findAllWithCompetencias() {
        const result = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.nome ASC
        `);
        return result.rows;
    }

    static async findAllWithDetails() {
        const result = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', nd.id,
                                'titulo', nd.titulo,
                                'descricao', nd.descricao,
                                'valor', nd.valor,
                                'data_criacao', nd.data_criacao
                            ) ORDER BY nd.id ASC
                        )
                        FROM notas_detalhadas nd
                        WHERE nd.aluno_id = a.id
                    ), 
                    '[]'::json
                ) as notas_individuais,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ac.id,
                                'competencia_id', ac.competencia_id,
                                'nome', c.nome,
                                'descricao', c.descricao,
                                'categoria', c.categoria,
                                'nota', ac.nota,
                                'observacoes', ac.observacoes,
                                'data_registro', ac.data_registro
                            ) ORDER BY ac.id ASC
                        )
                        FROM aluno_competencias ac
                        JOIN competencias c ON ac.competencia_id = c.id
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.id ASC
        `);
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query('SELECT * FROM alunos WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByIdWithLogin(id) {
        const result = await db.query(`
            SELECT 
                a.id,
                a.nome,
                a.presenca,
                al.email
            FROM alunos a
            LEFT JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `, [id]);
        return result.rows[0];
    }

    static async getCompetencias(alunoId) {
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

    static async create(nome, ano_escolar, idade) {
        const result = await db.query(
            `INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) 
             VALUES ($1, $2, $3, 0, 100, 'EM DESENVOLVIMENTO') RETURNING id`,
            [nome, ano_escolar, idade]
        );
        return result.rows[0].id;
    }

    static async updatePresenca(id, presenca) {
        await db.query('UPDATE alunos SET presenca = $1 WHERE id = $2', [presenca, id]);
    }

    static async delete(id) {
        await db.query('DELETE FROM alunos WHERE id = $1', [id]);
    }

    static async resetSequence() {
        const checkEmpty = await db.query('SELECT COUNT(*) FROM alunos');
        if (parseInt(checkEmpty.rows[0].count) === 0) {
            await db.query('ALTER SEQUENCE alunos_id_seq RESTART WITH 1');
        } else {
            await db.query("SELECT setval('alunos_id_seq', (SELECT MAX(id) FROM alunos))");
        }
    }

    static async truncateAll() {
        await db.query('TRUNCATE TABLE tarefas_alunos RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE tarefas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE aluno_competencias RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE notas_detalhadas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos_login RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos RESTART IDENTITY CASCADE');
    }

    static async getRankingGeral() {
        const result = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
        return result.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));
    }

    static async getRankingMedio() {
        const result = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%MÉDIO%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
        return result.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));
    }

    static async getRankingFundamental() {
        const result = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%FUNDAMENTAL%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);
        return result.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));
    }
}

module.exports = Aluno;
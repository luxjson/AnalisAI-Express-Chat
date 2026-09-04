const db = require('../db');

class AlunoLogin {
    static async findByMatricula(matricula) {
        const result = await db.query('SELECT id, nome, email, senha, matricula, aluno_id, status, data_criacao, ultimo_acesso FROM alunos_login WHERE matricula = $1', [matricula]);
        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await db.query('SELECT id, nome, email, senha, matricula, aluno_id, status, data_criacao, ultimo_acesso FROM alunos_login WHERE email = $1', [email]);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await db.query('SELECT id, nome, email, matricula, aluno_id, status, data_criacao, ultimo_acesso FROM alunos_login WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByAlunoId(alunoId) {
        const result = await db.query('SELECT id, nome, email, matricula, aluno_id, status, data_criacao, ultimo_acesso FROM alunos_login WHERE aluno_id = $1', [alunoId]);
        return result.rows[0];
    }

    static async create(nome, email, senha, matricula, alunoId, status = 'ATIVO') {
        const result = await db.query(
            `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [nome, email, senha, matricula, alunoId, status]
        );
        return result.rows[0].id;
    }

    static async updateSenha(alunoId, novaSenha) {
        await db.query('UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2', [novaSenha, alunoId]);
    }

    static async updateUltimoAcesso(alunoId) {
        await db.query(
            "UPDATE alunos_login SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE aluno_id = $1",
            [alunoId]
        );
    }

    static async updateStatus(alunoId, status) {
        await db.query('UPDATE alunos_login SET status = $1 WHERE aluno_id = $2', [status, alunoId]);
    }
}

module.exports = AlunoLogin;
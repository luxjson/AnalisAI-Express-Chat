const db = require('../db');

class Usuario {
    static async findByEmail(email) {
        const result = await db.query('SELECT id, nome, email, senha, cargo, status, data_criacao, ultimo_acesso FROM usuarios WHERE email = $1', [email.toLowerCase()]);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await db.query('SELECT id, nome, email, cargo, status, data_criacao FROM usuarios WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async create(nome, email, senha, cargo, status = 'ATIVO') {
        const result = await db.query(
            'INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [nome, email.toLowerCase(), senha, cargo, status]
        );
        return result.rows[0].id;
    }

    static async update(id, nome, email, cargo, status) {
        await db.query(
            'UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5',
            [nome, email.toLowerCase(), cargo, status, id]
        );
    }

    static async delete(id) {
        await db.query('DELETE FROM usuarios WHERE id = $1', [id]);
    }

    static async findAll() {
        const result = await db.query('SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC');
        return result.rows;
    }

    static async updatePassword(id, novaSenha) {
        await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [novaSenha, id]);
    }

    static async findAdmins() {
        const result = await db.query('SELECT id FROM usuarios WHERE cargo = $1', ['Admin']);
        return result.rows;
    }
}

module.exports = Usuario;
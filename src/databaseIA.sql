-- IA module migration for the existing AnalisAI database.
-- Run this after database.sql when upgrading an older installation.

CREATE TABLE IF NOT EXISTS ia_conversas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(120) NOT NULL DEFAULT 'Nova conversa',
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fixado BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK ((usuario_id IS NOT NULL AND aluno_id IS NULL) OR (usuario_id IS NULL AND aluno_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ia_mensagens (
    id SERIAL PRIMARY KEY,
    conversa_id INTEGER NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
    papel VARCHAR(20) NOT NULL CHECK (papel IN ('user', 'model')),
    conteudo TEXT NOT NULL,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ia_conversas ADD COLUMN IF NOT EXISTS fixado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ia_conversas_usuario ON ia_conversas(usuario_id, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_aluno ON ia_conversas(aluno_id, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_fixadas ON ia_conversas(fixado, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_mensagens_conversa ON ia_mensagens(conversa_id, data_criacao ASC);

CREATE TABLE IF NOT EXISTS ia_auditoria_notas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    competencia_id INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
    nota_anterior DECIMAL(3,1),
    nota_nova DECIMAL(3,1) NOT NULL CHECK (nota_nova >= 0 AND nota_nova <= 10),
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_notas_usuario ON ia_auditoria_notas(usuario_id, data_criacao DESC);

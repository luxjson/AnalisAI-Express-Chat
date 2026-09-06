
-- acho q novo 

CREATE TABLE IF NOT EXISTS web_sessions (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_sessions_expire ON web_sessions(expire);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Professor',
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_escolar VARCHAR(50) NOT NULL CHECK (ano_escolar IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')),
    idade INTEGER NOT NULL CHECK (idade >= 10 AND idade <= 20),
    nota DECIMAL(3,1) DEFAULT 0.0 CHECK (nota >= 0 AND nota <= 10),
    presenca INTEGER DEFAULT 100 CHECK (presenca >= 0 AND presenca <= 100),
    nivel VARCHAR(30) DEFAULT 'EM DESENVOLVIMENTO'
);

CREATE TABLE IF NOT EXISTS alunos_login (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    aluno_id INTEGER UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competencias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    categoria VARCHAR(50) DEFAULT 'Técnica',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aluno_competencias (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER NOT NULL,
    competencia_id INTEGER NOT NULL,
    nota DECIMAL(3,1) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    observacoes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (competencia_id) REFERENCES competencias(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tarefas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    turma VARCHAR(50) NOT NULL,
    competencia_id INTEGER REFERENCES competencias(id) ON DELETE SET NULL,
    data_entrega DATE,
    prioridade VARCHAR(20) DEFAULT 'MEDIA',
    status VARCHAR(20) DEFAULT 'ATIVA',
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tarefas_alunos (
    id SERIAL PRIMARY KEY,
    tarefa_id INTEGER NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    nota DECIMAL(3,1) CHECK (nota >= 0 AND nota <= 10),
    feedback TEXT,
    resposta_texto TEXT,
    resposta_arquivo VARCHAR(255),
    data_entrega TIMESTAMP,
    data_avaliacao TIMESTAMP,
    UNIQUE(tarefa_id, aluno_id)
);
CREATE TABLE IF NOT EXISTS notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensagem TEXT,
    link VARCHAR(255),
    icone VARCHAR(50) DEFAULT 'fas fa-bell',
    cor VARCHAR(20) DEFAULT '#ff0101',
    lida BOOLEAN DEFAULT FALSE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (usuario_id IS NOT NULL AND aluno_id IS NULL) OR
        (usuario_id IS NULL AND aluno_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS configuracoes_notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    notificacoes_ativas BOOLEAN DEFAULT TRUE,
    notificacoes_email BOOLEAN DEFAULT FALSE,
    notificacoes_tarefas BOOLEAN DEFAULT TRUE,
    notificacoes_avaliacoes BOOLEAN DEFAULT TRUE,
    notificacoes_competencias BOOLEAN DEFAULT TRUE,
    CHECK (
        (usuario_id IS NOT NULL AND aluno_id IS NULL) OR
        (usuario_id IS NULL AND aluno_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS calendario_eventos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE CHECK (data_fim IS NULL OR data_fim >= data_inicio),
    turma VARCHAR(50),
    cor VARCHAR(20) DEFAULT '#ff0101',
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feriados (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    data DATE NOT NULL,
    recorrente BOOLEAN DEFAULT FALSE,
    UNIQUE(data, nome)
);

CREATE TABLE IF NOT EXISTS solicitacoes_senha (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_resposta TIMESTAMP,
    respondido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);



-- Serverless/security infrastructure used by the application.
CREATE TABLE IF NOT EXISTS security_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_window ON security_rate_limits(window_start);

CREATE TABLE IF NOT EXISTS uploaded_files (
    storage_key TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at ON uploaded_files(created_at DESC);

CREATE TABLE IF NOT EXISTS system_backups (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origem TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    table_count INTEGER NOT NULL CHECK (table_count >= 0),
    content JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups(created_at DESC);

-- Runtime-compatible migration for installations created with older schemas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='filename') THEN
    ALTER TABLE system_backups ADD COLUMN filename TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='created_at') THEN
    ALTER TABLE system_backups ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='origem') THEN
    ALTER TABLE system_backups ADD COLUMN origem TEXT NOT NULL DEFAULT 'migracao';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='size_bytes') THEN
    ALTER TABLE system_backups ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='table_count') THEN
    ALTER TABLE system_backups ADD COLUMN table_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='content') THEN
    ALTER TABLE system_backups ADD COLUMN content JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='reason') THEN
    ALTER TABLE system_backups ALTER COLUMN reason SET DEFAULT 'migracao';
    UPDATE system_backups SET reason = 'migracao' WHERE reason IS NULL OR reason = '';
  END IF;
END $$;
UPDATE system_backups SET filename = 'backup-analisai-migrado-' || id || '.json' WHERE filename IS NULL OR filename = '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_backups_filename ON system_backups(filename);


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
CREATE INDEX IF NOT EXISTS idx_ia_conversas_usuario ON ia_conversas(usuario_id, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_aluno ON ia_conversas(aluno_id, data_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_fixadas ON ia_conversas(fixado, data_atualizacao DESC);

CREATE TABLE IF NOT EXISTS ia_mensagens (
    id SERIAL PRIMARY KEY,
    conversa_id INTEGER NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
    papel VARCHAR(20) NOT NULL CHECK (papel IN ('user', 'model')),
    conteudo TEXT NOT NULL,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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

CREATE INDEX IF NOT EXISTS idx_calendario_data ON calendario_eventos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_calendario_turma ON calendario_eventos(turma);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno ON notificacoes(aluno_id, lida, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_alunos_login_email ON alunos_login(email);
CREATE INDEX IF NOT EXISTS idx_alunos_login_matricula ON alunos_login(matricula);
CREATE INDEX IF NOT EXISTS idx_alunos_login_aluno ON alunos_login(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_aluno ON aluno_competencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_comp ON aluno_competencias(competencia_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_turma ON tarefas(turma);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_alunos_aluno ON tarefas_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_alunos_tarefa ON tarefas_alunos(tarefa_id);

INSERT INTO competencias (nome, descricao, categoria) VALUES
('Raciocínio Lógico', 'Capacidade de resolver problemas usando lógica e pensamento estruturado', 'Cognitiva'),
('Comunicação', 'Habilidade de expressar ideias de forma clara e objetiva', 'Comportamental'),
('Trabalho em Equipe', 'Capacidade de colaborar e contribuir em grupo', 'Socioemocional'),
('Proatividade', 'Iniciativa para realizar tarefas sem necessidade de cobrança', 'Comportamental'),
('Criatividade', 'Capacidade de pensar em soluções inovadoras', 'Cognitiva'),
('Liderança', 'Habilidade de influenciar e guiar pessoas', 'Socioemocional'),
('Organização', 'Capacidade de planejar e estruturar atividades', 'Comportamental'),
('Pensamento Crítico', 'Análise e avaliação de situações de forma fundamentada', 'Cognitiva'),
('Resiliência', 'Capacidade de superar desafios e adversidades', 'Socioemocional'),
('Ética', 'Compromisso com valores e princípios morais', 'Comportamental')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel)
SELECT * FROM (VALUES
('LUCAS SILVA', '3º MÉDIO', 17, 9.5::numeric, 100, 'APTO'),
('MARIA OLIVEIRA', '2º MÉDIO', 16, 4.2::numeric, 85, 'INAPTO'),
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5::numeric, 90, 'EM DESENVOLVIMENTO'),
('ANA BEATRIZ', '9º FUNDAMENTAL', 14, 8.0::numeric, 95, 'APTO'),
('CARLOS EDUARDO', '9º FUNDAMENTAL', 13, 3.5::numeric, 60, 'INAPTO'),
('BEATRIZ SOUZA', '3º MÉDIO', 17, 7.0::numeric, 80, 'APTO')
) AS seed(nome, ano_escolar, idade, nota, presenca, nivel)
WHERE NOT EXISTS (SELECT 1 FROM alunos a WHERE a.nome = seed.nome);

INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
SELECT 
    a.id, 
    c.id, 
    CASE 
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Raciocínio Lógico' THEN 9.0
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Comunicação' THEN 8.5
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Liderança' THEN 9.5
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Raciocínio Lógico' THEN 4.0
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Comunicação' THEN 5.5
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Organização' THEN 3.5
        WHEN a.nome = 'JOÃO PEDRO' AND c.nome = 'Raciocínio Lógico' THEN 6.0
        WHEN a.nome = 'JOÃO PEDRO' AND c.nome = 'Proatividade' THEN 7.0
        WHEN a.nome = 'ANA BEATRIZ' AND c.nome = 'Comunicação' THEN 8.5
        WHEN a.nome = 'ANA BEATRIZ' AND c.nome = 'Trabalho em Equipe' THEN 9.0
        WHEN a.nome = 'CARLOS EDUARDO' AND c.nome = 'Raciocínio Lógico' THEN 3.0
        WHEN a.nome = 'CARLOS EDUARDO' AND c.nome = 'Organização' THEN 4.0
        WHEN a.nome = 'BEATRIZ SOUZA' AND c.nome = 'Liderança' THEN 8.0
        WHEN a.nome = 'BEATRIZ SOUZA' AND c.nome = 'Comunicação' THEN 7.5
    END,
    'Avaliação inicial'
FROM alunos a, competencias c
WHERE 
    (a.nome = 'LUCAS SILVA' AND c.nome IN ('Raciocínio Lógico', 'Comunicação', 'Liderança')) OR
    (a.nome = 'MARIA OLIVEIRA' AND c.nome IN ('Raciocínio Lógico', 'Comunicação', 'Organização')) OR
    (a.nome = 'JOÃO PEDRO' AND c.nome IN ('Raciocínio Lógico', 'Proatividade')) OR
    (a.nome = 'ANA BEATRIZ' AND c.nome IN ('Comunicação', 'Trabalho em Equipe')) OR
    (a.nome = 'CARLOS EDUARDO' AND c.nome IN ('Raciocínio Lógico', 'Organização')) OR
    (a.nome = 'BEATRIZ SOUZA' AND c.nome IN ('Liderança', 'Comunicação'))
ON CONFLICT DO NOTHING;


-- Future writes on older databases are also protected. NOT VALID keeps the migration safe
-- when an existing database contains legacy rows that the repair tool will clean later.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alunos_idade_range_check') THEN
    ALTER TABLE alunos ADD CONSTRAINT alunos_idade_range_check CHECK (idade >= 10 AND idade <= 20) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alunos_nota_range_check') THEN
    ALTER TABLE alunos ADD CONSTRAINT alunos_nota_range_check CHECK (nota >= 0 AND nota <= 10) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendario_data_fim_check') THEN
    ALTER TABLE calendario_eventos ADD CONSTRAINT calendario_data_fim_check CHECK (data_fim IS NULL OR data_fim >= data_inicio) NOT VALID;
  END IF;
END $$;

-- Idempotent integrity constraints. These blocks are safe to run against
-- databases that already contain the named constraints.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_cargo_check') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_check
      CHECK (cargo IN ('Professor', 'Admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_status_check') THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_status_check
      CHECK (status IN ('ATIVO', 'INATIVO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alunos_login_status_check') THEN
    ALTER TABLE alunos_login ADD CONSTRAINT alunos_login_status_check
      CHECK (status IN ('ATIVO', 'INATIVO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_prioridade_check') THEN
    ALTER TABLE tarefas ADD CONSTRAINT tarefas_prioridade_check
      CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_status_check') THEN
    ALTER TABLE tarefas ADD CONSTRAINT tarefas_status_check
      CHECK (status IN ('ATIVA', 'INATIVA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_alunos_status_check') THEN
    ALTER TABLE tarefas_alunos ADD CONSTRAINT tarefas_alunos_status_check
      CHECK (status IN ('PENDENTE', 'ENTREGUE', 'CONCLUIDA', 'DEVOLVIDA', 'ATRASADA'));
  END IF;
END $$;

-- Remove duplicate notification configurations before creating unique indexes.
DELETE FROM configuracoes_notificacoes a
USING configuracoes_notificacoes b
WHERE a.id < b.id AND a.usuario_id IS NOT NULL AND a.usuario_id = b.usuario_id;
DELETE FROM configuracoes_notificacoes a
USING configuracoes_notificacoes b
WHERE a.id < b.id AND a.aluno_id IS NOT NULL AND a.aluno_id = b.aluno_id;

-- A notification configuration belongs to exactly one principal and should
-- have at most one row per principal, preventing concurrent duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_config_notif_usuario
  ON configuracoes_notificacoes(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_config_notif_aluno
  ON configuracoes_notificacoes(aluno_id) WHERE aluno_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status
  ON solicitacoes_senha(status, data_solicitacao DESC);


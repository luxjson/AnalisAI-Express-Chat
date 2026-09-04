-- =====================================================
-- DATABASE ANALISAI - ESTRUTURA ESSENCIAL
-- =====================================================

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Professor',
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Alunos (com restrição de ano_escolar)
CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_escolar VARCHAR(20) NOT NULL CHECK (ano_escolar IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')),
    idade INTEGER NOT NULL,
    nota DECIMAL(3,1) DEFAULT 0.0,
    presenca INTEGER DEFAULT 100,
    nivel VARCHAR(20) DEFAULT 'EM DESENVOLVIMENTO' CHECK (nivel IN ('APTO', 'INAPTO', 'EM DESENVOLVIMENTO'))
);

-- Tabela de Notas Detalhadas
CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2) CHECK (valor >= 0 AND valor <= 10),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Competências (catálogo)
CREATE TABLE IF NOT EXISTS competencias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    categoria VARCHAR(50) DEFAULT 'Técnica',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Aluno_Competencias (relacionamento)
CREATE TABLE IF NOT EXISTS aluno_competencias (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    competencia_id INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
    nota DECIMAL(3,1) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    observacoes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_aluno ON aluno_competencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_comp ON aluno_competencias(competencia_id);
CREATE INDEX IF NOT EXISTS idx_notas_aluno ON notas_detalhadas(aluno_id);

-- =====================================================
-- DADOS INICIAIS OBRIGATÓRIOS
-- =====================================================

-- Usuário administrador padrão
-- Competências padrão do sistema
INSERT INTO competencias (nome, descricao, categoria) VALUES
('Raciocínio Lógico', 'Capacidade de resolver problemas usando lógica', 'Cognitiva'),
('Comunicação', 'Habilidade de expressar ideias de forma clara', 'Comportamental'),
('Trabalho em Equipe', 'Capacidade de colaborar em grupo', 'Socioemocional'),
('Proatividade', 'Iniciativa para realizar tarefas', 'Comportamental'),
('Criatividade', 'Capacidade de pensar em soluções inovadoras', 'Cognitiva'),
('Liderança', 'Habilidade de influenciar pessoas', 'Socioemocional'),
('Organização', 'Capacidade de planejar atividades', 'Comportamental'),
('Pensamento Crítico', 'Análise fundamentada de situações', 'Cognitiva'),
('Resiliência', 'Capacidade de superar desafios', 'Socioemocional'),
('Ética', 'Compromisso com valores morais', 'Comportamental')
ON CONFLICT (nome) DO NOTHING;

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAIS - COMENTAR SE NÃO QUISER)
-- =====================================================

-- Alunos de exemplo
INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES 
('LUCAS SILVA', '3º MÉDIO', 17, 9.5, 100, 'APTO'),
('MARIA OLIVEIRA', '2º MÉDIO', 16, 4.2, 85, 'INAPTO'),
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5, 90, 'EM DESENVOLVIMENTO'),
('ANA BEATRIZ', '9º FUNDAMENTAL', 14, 8.0, 95, 'APTO'),
('CARLOS EDUARDO', '9º FUNDAMENTAL', 13, 3.5, 60, 'INAPTO'),
('BEATRIZ SOUZA', '3º MÉDIO', 17, 7.0, 80, 'APTO');

-- Competências para os alunos de exemplo
INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
SELECT a.id, c.id, 
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
-- Limpa conversas, mensagens e auditorias antigas da IA.
-- Execute somente quando quiser apagar os dados antigos:
-- psql -U postgres -d analisai -f src/limparHistoricoIA.sql
TRUNCATE TABLE ia_mensagens, ia_conversas, ia_auditoria_notas RESTART IDENTITY CASCADE;
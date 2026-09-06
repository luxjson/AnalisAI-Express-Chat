# AnalisAI — Revisão Sênior Completa / Vercel

Data: 06/09/2026

## Escopo

Revisão do projeto inteiro recebido, com prioridade para segurança, falhas, gargalos de lógica, casos de borda, consistência entre camadas e execução serverless na Vercel. O código funcional foi revisado por arquivo; assets binários foram preservados.

## Resultado executivo

- Corrigido o crash de inicialização causado por handler inexistente em `routes/aluno.js`: a versão corrigida anterior havia removido acidentalmente `exports.equipe` de `alunoController.js`. O handler foi restaurado.
- 62 arquivos JavaScript passam em `node --check`.
- Todos os handlers referenciados pelas rotas foram validados estaticamente.
- Adicionado `scripts/verify-project.js` e `npm test` para impedir regressões desse tipo.
- `app.listen()` somente em execução local; Vercel usa `api/index.js`.
- Uploads persistentes no PostgreSQL no Vercel; fallback para arquivos locais durante desenvolvimento/migração.
- Backups persistentes no PostgreSQL e endpoint de cron protegido por `CRON_SECRET`.
- Rate limit persistente em PostgreSQL para sobreviver a múltiplas instâncias serverless.
- CSRF mantido para mutações; importação JSON corrigida para enviar o token.
- Validação de datas, booleanos, IDs, nomes, e-mails e notas reforçada.
- Importação de alunos passou a usar transação, reduzir consultas desnecessárias e evitar registros parcialmente importados.
- Invalidação de sessões adicionada para exclusão/alteração de contas e regeneração de senha de alunos.
- Erros de JSON/upload agora retornam códigos apropriados em vez de 500 genérico.
- SQL da IA deixou de depender de comandos `\connect`/`\gexec` específicos do psql.
- Seed inicial ficou idempotente.
- `.env` e backups locais não fazem parte da entrega final.

## Bugs críticos encontrados

### 1. Handler de rota inexistente — CRÍTICO

`routes/aluno.js` registrava `alunoController.equipe`, mas a versão corrigida anterior não exportava essa função. Express 5 recusava a rota na inicialização com `TypeError: argument handler must be a function`.

Correção:

```js
exports.equipe = (req, res) => {
  res.render('dashboard/dashboardEquipe', {
    user: req.session.user,
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin'
  });
};
```

Também foi criado um teste estático para detectar qualquer referência a handler não exportado.

### 2. `app.listen()` incompatível com serverless — CRÍTICO

O servidor iniciava listener sempre. Agora:

```js
if (require.main === module) {
  app.listen(PORT, ...);
}
module.exports = app;
```

### 3. Persistência local de uploads — CRÍTICO

Filesystem da função serverless não é armazenamento persistente. Foi criado `uploaded_files` com `BYTEA`, mantendo autorização por tarefa/aluno/professor.

### 4. Backup local — CRÍTICO

`src/backups` não é persistente na Vercel. Backups agora ficam em `system_backups`. A Vercel chama `/api/internal/backup` por cron.

### 5. Rate limit em memória — ALTO

Mapas locais não são compartilhados entre instâncias. Agora o contador é atômico no PostgreSQL e falha fechado (`503`) se o mecanismo de proteção não estiver disponível.

### 6. Reuso de `AbortSignal` na segunda tentativa da IA — ALTO

A implementação reutilizava uma requisição com o mesmo `AbortSignal`; depois do timeout, o retry podia falhar imediatamente. Agora cada tentativa cria um novo request/signal.

Além disso, o timeout foi ajustado para manter duas tentativas dentro do limite configurado da função Vercel.

### 7. Importação sem transação — ALTO

Se o aluno fosse criado e o login falhasse, ficava registro parcial. Agora a operação é atômica.

### 8. Tarefa podia receber alunos de outra turma — ALTO

IDs enviados pelo cliente eram aceitos diretamente. Agora a lista é filtrada pelo `ano_escolar` da tarefa no próprio banco.

### 9. Sessões sobreviviam a exclusão/troca de credenciais — ALTO

Sessões de usuário/aluno afetado agora são invalidadas quando necessário.

### 10. CSRF ausente na importação JSON — ALTO

`importar-dados-completos` fazia POST sem `X-CSRF-Token`. O navegador passava a ser bloqueado pelo middleware. Corrigido no frontend.

### 11. Configurações de notificação com race condition — MÉDIO/ALTO

`SELECT` seguido de `INSERT` podia gerar duplicidade concorrente. Foi substituído por `INSERT ... ON CONFLICT` e os cinco campos agora são validados.

### 12. Datas apenas com regex — MÉDIO

Datas como `2026-99-99` passavam da validação e só falhavam no PostgreSQL. Criado `dateOnly()` com validação real de calendário.

### 13. Eventos do calendário podiam desaparecer em meses intermediários — MÉDIO

A consulta verificava apenas mês de início/fim. Agora usa sobreposição do intervalo do evento com o intervalo do mês.

### 14. Possível XSS em parâmetros inline EJS — ALTO

Nomes/títulos inseridos em `onclick` não estavam adequadamente protegidos contra backslash/apóstrofo e conteúdo controlado pelo usuário. Foram trocados por literais JSON seguros para o contexto HTML/JS.

### 15. Checkup administrativo sem expiração — MÉDIO

O desbloqueio permanecia ativo durante toda a sessão. Agora expira após 10 minutos e a verificação recebeu rate limit.

## Segurança

- Sessões com cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Cookie de sessão de produção usa prefixo `__Host-`.
- Regeneração de sessão após autenticação/troca de senha.
- CSRF com token aleatório e assinatura HMAC.
- Same-Origin Protection para métodos mutáveis.
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy, Permissions Policy e HSTS em produção.
- Queries parametrizadas nos pontos dinâmicos.
- IDs e enums validados no servidor.
- Upload limitado a 10 MB e com extensão/MIME + verificação de assinatura para formatos binários principais.
- Arquivos só são baixados após autorização baseada na relação tarefa/aluno/professor.
- Segredos não são enviados no ZIP final.

## Banco de dados

`database.sql` agora contém também a infraestrutura necessária para:

- sessões;
- IA;
- rate limiting;
- uploads persistentes;
- backups persistentes.

`databaseIA.sql` foi transformado em migration portátil para um banco já existente, sem `\connect`/`\gexec`.

Índices e constraints de integridade foram mantidos/adicionados onde compatíveis com o comportamento atual.

## Vercel

Arquivos principais:

- `api/index.js` — entrada serverless.
- `vercel.json` — rewrite global, duração máxima da função e cron de backup.
- `src/app.js` — exporta Express sem abrir porta no ambiente serverless.

Variáveis necessárias em produção estão documentadas em `.env.example`, incluindo `SESSION_SECRET`, `APP_ORIGIN`, `CRON_SECRET`, `DB_URL`, `AI_KEY` e `PASS_DELETE`.

## Verificações executadas

- `node --check` em todos os JavaScript.
- Validação estática de todos os handlers referenciados nas rotas.
- Verificação de arquivos obrigatórios do deploy.
- Varredura de referências estáticas e formulários POST.
- Inventário final: 62 JS, 28 EJS, 26 CSS, 4 SQL.

A instalação completa via `npm ci` foi tentada, mas o ambiente de execução atingiu timeout de transporte durante o download das dependências. Portanto não é declarado um teste end-to-end como se tivesse sido executado. O projeto, porém, contém `npm test` para executar a verificação estrutural localmente.

## Arquivos JavaScript revisados

- `api/index.js`
- `scripts/verify-project.js`
- `src/app.js`
- `src/controllers/adminController.js`
- `src/controllers/aiController.js`
- `src/controllers/alunoController.js`
- `src/controllers/apiController.js`
- `src/controllers/authController.js`
- `src/controllers/calendarioController.js`
- `src/controllers/professorController.js`
- `src/controllers/tarefaController.js`
- `src/db.js`
- `src/fileStore.js`
- `src/middlewares/auth.js`
- `src/middlewares/flash.js`
- `src/middlewares/security.js`
- `src/middlewares/upload.js`
- `src/models/Aluno.js`
- `src/models/Calendario.js`
- `src/models/Competencia.js`
- `src/models/ConfiguracaoNotificacao.js`
- `src/models/Notificacao.js`
- `src/models/SolicitacaoSenha.js`
- `src/models/Tarefa.js`
- `src/models/Usuario.js`
- `src/models/alunoLogin.js`
- `src/public/js/components/notifications.js`
- `src/public/js/components/settings-modal.js`
- `src/public/js/components/sidebar-professor.js`
- `src/public/js/components/sidebar-student.js`
- `src/public/js/pages/auth/error.js`
- `src/public/js/pages/auth/login.js`
- `src/public/js/pages/dashboard/ai-editor.js`
- `src/public/js/pages/dashboard/calendar.js`
- `src/public/js/pages/dashboard/charts.js`
- `src/public/js/pages/dashboard/config.js`
- `src/public/js/pages/dashboard/edit.js`
- `src/public/js/pages/dashboard/main.js`
- `src/public/js/pages/dashboard/requests.js`
- `src/public/js/pages/dashboard/tasks.js`
- `src/public/js/pages/dashboard/users.js`
- `src/public/js/pages/student/competencies.js`
- `src/public/js/pages/student/dashboard.js`
- `src/public/js/pages/student/evolution.js`
- `src/public/js/pages/student/profile.js`
- `src/public/js/pages/student/tasks.js`
- `src/public/js/shared/ai-chat.js`
- `src/public/js/shared/common.js`
- `src/public/js/shared/phosphor-icons.js`
- `src/public/js/shared/theme-init.js`
- `src/routes/admin.js`
- `src/routes/aluno.js`
- `src/routes/api.js`
- `src/routes/index.js`
- `src/routes/professor.js`
- `src/services/aiService.js`
- `src/services/backupService.js`
- `src/services/checkupService.js`
- `src/sessionStore.js`
- `src/utils/dateFormatter.js`
- `src/utils/notificacao.js`
- `src/utils/validation.js`

## Templates EJS preservados/revisados

- `src/views/aluno/alunoCompetencias.ejs`
- `src/views/aluno/alunoDashboard.ejs`
- `src/views/aluno/alunoEvolucao.ejs`
- `src/views/aluno/alunoIA.ejs`
- `src/views/aluno/alunoPerfil.ejs`
- `src/views/aluno/alunoTarefas.ejs`
- `src/views/dashboard/dashboardCalendario.ejs`
- `src/views/dashboard/dashboardConfig.ejs`
- `src/views/dashboard/dashboardEdit.ejs`
- `src/views/dashboard/dashboardEquipe.ejs`
- `src/views/dashboard/dashboardGraficos.ejs`
- `src/views/dashboard/dashboardIA.ejs`
- `src/views/dashboard/dashboardMain.ejs`
- `src/views/dashboard/dashboardSolicitacoes.ejs`
- `src/views/dashboard/dashboardTarefas.ejs`
- `src/views/dashboard/dashboardUsuarios.ejs`
- `src/views/error.ejs`
- `src/views/esqueciSenha.ejs`
- `src/views/index.ejs`
- `src/views/login.ejs`
- `src/views/manuais.ejs`
- `src/views/manualDoAluno.ejs`
- `src/views/manualDoProfessor.ejs`
- `src/views/partials/barAluno.ejs`
- `src/views/partials/barProfessor.ejs`
- `src/views/partials/header.ejs`
- `src/views/partials/notificacoes.ejs`
- `src/views/termos.ejs`

## CSS preservados/revisados estruturalmente

- `src/public/css/base/dashboard.css`
- `src/public/css/base/light-theme.css`
- `src/public/css/components/notifications.css`
- `src/public/css/components/sidebar.css`
- `src/public/css/pages/ai.css`
- `src/public/css/pages/calendar.css`
- `src/public/css/pages/charts.css`
- `src/public/css/pages/competencies.css`
- `src/public/css/pages/config.css`
- `src/public/css/pages/dashboard-config.css`
- `src/public/css/pages/edit.css`
- `src/public/css/pages/evolution.css`
- `src/public/css/pages/forgot-password.css`
- `src/public/css/pages/home.css`
- `src/public/css/pages/login.css`
- `src/public/css/pages/manuals.css`
- `src/public/css/pages/requests.css`
- `src/public/css/pages/student-evolution.css`
- `src/public/css/pages/student-manual.css`
- `src/public/css/pages/student-profile.css`
- `src/public/css/pages/student-tasks.css`
- `src/public/css/pages/tasks.css`
- `src/public/css/pages/teacher-manual.css`
- `src/public/css/pages/team.css`
- `src/public/css/pages/terms.css`
- `src/public/css/pages/users.css`

## SQL revisados

- `src/database.sql`
- `src/databaseIA.sql`
- `src/databaseOldVersion.sql`
- `src/limparHistoricoIA.sql`

## Observação de segurança

O projeto original continha `.env`. Ele não está na entrega final. Se as credenciais desse `.env` já foram usadas em qualquer ambiente ou repositório, elas devem ser rotacionadas antes do deploy.

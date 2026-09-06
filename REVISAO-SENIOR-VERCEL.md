# Revisão sênior — AnalisAI / Vercel

## Correções críticas aplicadas

- **Inicialização incompatível com serverless:** `src/app.js` chamava `app.listen()` sempre. Agora o servidor só abre porta quando executado diretamente e exporta o Express app para `api/index.js`.
- **Uploads efêmeros no Vercel:** novos uploads não dependem mais do filesystem do runtime no Vercel. Eles são armazenados em PostgreSQL (`uploaded_files`) e continuam sujeitos à autorização de acesso existente. Em execução local, o comportamento por disco é preservado.
- **Backups efêmeros:** snapshots deixaram de depender de `src/backups`. Agora são armazenados em PostgreSQL (`system_backups`), limitados aos 15 mais recentes e baixados somente após a validação administrativa já existente.
- **Rate limit inconsistente em múltiplas instâncias:** o limitador em memória foi substituído por contador atômico persistente em PostgreSQL (`security_rate_limits`). Isso evita que trocar de instância serverless zere as tentativas.
- **Bypass do limitador quando o mapa em memória lotava:** eliminado junto com o limitador antigo.
- **Tratamento inadequado de upload inválido:** erros do Multer agora retornam resposta controlada; arquivo acima de 10 MB gera 413 e tipo inválido gera 400/redirect, sem stack trace em produção.
- **Segredos e dados operacionais no pacote:** `.env` foi retirado; `.gitignore` agora cobre `src/uploads`, `src/backups`, `.vercel` e arquivos de ambiente.
- **Compatibilidade de arquivos legados:** uploads já empacotados em `src/uploads` continuam podendo ser lidos antes do fallback para o armazenamento PostgreSQL, evitando quebra imediata de referências existentes.
- **Status de backup assíncrono:** chamadas que tratavam `getBackupStatus()` como síncrono foram corrigidas com `await`.

## Fluxo de exceções e falhas

- O handler global não expõe stack trace em produção.
- Erros conhecidos de constraint PostgreSQL continuam sendo traduzidos para mensagem de validação.
- Erros do upload são diferenciados de falha interna.
- Falha no rate limiter persistente resulta em 503 (fail-closed), evitando liberar autenticação/IA sem controle de abuso quando o banco está indisponível.
- A persistência de arquivo no Vercel é revertida se a atualização da entrega não for aceita, reduzindo arquivos órfãos.

## Casos de borda tratados

- Envio de tarefa sem texto e sem arquivo é rejeitado.
- Reenvio de tarefa fora dos estados permitidos remove o arquivo recém-persistido.
- Nome de arquivo continua validado e acesso continua condicionado a aluno dono, professor criador ou admin.
- Chave do rate limit usa hash SHA-256 do prefixo + IP e a atualização da janela é atômica.
- Backups mantêm retenção máxima de 15 registros.

## Variáveis obrigatórias na Vercel

- `DB_URL`
- `SESSION_SECRET` com pelo menos 32 caracteres
- `APP_ORIGIN` com a origem HTTPS exata, sem caminho, por exemplo `https://seu-dominio.vercel.app`
- `AI_KEY` quando a IA estiver habilitada
- `AI_PROVIDER` / `AI_MODEL` conforme o provedor usado

`DB_SSL_REJECT_UNAUTHORIZED=false` é bloqueado em produção pelo próprio projeto.

## Limitação operacional restante

O backup armazenado no mesmo PostgreSQL protege contra perda do filesystem serverless, mas **não substitui um backup externo/disaster recovery do provedor do banco**. Para desastre completo do banco, configure também snapshots/PITR no Neon ou outro armazenamento externo.

## Validações executadas

- `node --check` em todos os arquivos JavaScript de `src/` e `api/`: aprovado.
- Auditoria das rotas mutáveis: passam pelo middleware global de origem/CSRF; a rota multipart do aluno mantém `csrfProtection` após o parser do upload.
- Busca por construção SQL com interpolação direta de entrada: não foi encontrada interpolação de entrada do usuário nos pontos auditados; o único campo dinâmico de login é fechado em duas opções internas (`matricula`/`email`).
- Instalação completa via `npm ci` não pôde ser concluída no ambiente de revisão por timeout externo; por isso o teste de execução com dependências reais não foi certificado aqui.

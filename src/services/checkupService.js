const db = require("../db");
const bcrypt = require("bcryptjs");

/**
 * Tabelas gerenciadas pelo sistema para diagnóstico
 */
const SYSTEM_TABLES = [
  "usuarios",
  "alunos",
  "alunos_login",
  "competencias",
  "aluno_competencias",
  "notas_detalhadas",
  "tarefas",
  "tarefas_alunos",
  "calendario_eventos",
  "feriados",
  "solicitacoes_senha",
  "notificacoes",
  "configuracoes_notificacoes",
  "ia_conversas",
  "ia_mensagens",
  "ia_auditoria_notas",
];

/**
 * Executa o diagnóstico completo de todas as tabelas
 */
async function runSystemCheckup() {
  const results = [];

  for (const tableName of SYSTEM_TABLES) {
    try {
      const tableDiagnostic = await diagnoseTable(tableName);
      results.push(tableDiagnostic);
    } catch (err) {
      console.error(`Erro ao diagnosticar tabela ${tableName}:`, err.message);
      results.push({
        table: tableName,
        exists: false,
        totalRows: 0,
        hasIssues: true,
        issuesCount: 1,
        issues: ["Erro ao verificar a estrutura da tabela."],
      });
    }
  }

  const totalIssues = results.reduce((acc, curr) => acc + curr.issuesCount, 0);
  const healthyTables = results.filter((r) => !r.hasIssues).length;

  return {
    timestamp: new Date().toISOString(),
    totalTables: results.length,
    healthyTables,
    problematicTables: results.length - healthyTables,
    totalIssues,
    isHealthy: totalIssues === 0,
    tables: results,
  };
}
async function diagnoseTable(tableName) {
  const countRes = await db.query(
    `
        SELECT COUNT(*) as total FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName],
  );

  if (parseInt(countRes.rows[0].total) === 0) {
    return {
      table: tableName,
      exists: false,
      totalRows: 0,
      hasIssues: true,
      issuesCount: 1,
      issues: ["Tabela não existe no banco de dados."],
    };
  }

  const rowCountRes = await db.query(
    `SELECT COUNT(*) as total FROM ${tableName}`,
  );
  const totalRows = parseInt(rowCountRes.rows[0].total);
  const issues = [];

  switch (tableName) {
    case "alunos": {
      const invalidPresenca = await db.query(`
                SELECT COUNT(*) as count FROM alunos WHERE presenca < 0 OR presenca > 100
            `);
      if (parseInt(invalidPresenca.rows[0].count) > 0) {
        issues.push(
          `${invalidPresenca.rows[0].count} aluno(s) com frequência fora da faixa permitida (0-100%).`,
        );
      }

      const invalidNota = await db.query(`
                SELECT COUNT(*) as count FROM alunos WHERE nota < 0 OR nota > 10
            `);
      if (parseInt(invalidNota.rows[0].count) > 0) {
        issues.push(
          `${invalidNota.rows[0].count} aluno(s) com média geral fora do intervalo (0.0 - 10.0).`,
        );
      }

      const invalidIdade = await db.query(`
                SELECT COUNT(*) as count FROM alunos WHERE idade < 10 OR idade > 20
            `);
      if (parseInt(invalidIdade.rows[0].count) > 0) {
        issues.push(
          `${invalidIdade.rows[0].count} aluno(s) com idade atípica (< 10 ou > 20 anos).`,
        );
      }

      const semLogin = await db.query(`
                SELECT COUNT(*) as count FROM alunos a 
                LEFT JOIN alunos_login al ON a.id = al.aluno_id 
                WHERE al.id IS NULL
            `);
      if (parseInt(semLogin.rows[0].count) > 0) {
        issues.push(
          `${semLogin.rows[0].count} aluno(s) cadastrado(s) sem credenciais de acesso no portal.`,
        );
      }
      break;
    }

    case "alunos_login": {
      const orfaosLogin = await db.query(`
                SELECT COUNT(*) as count FROM alunos_login al 
                LEFT JOIN alunos a ON al.aluno_id = a.id 
                WHERE a.id IS NULL
            `);
      if (parseInt(orfaosLogin.rows[0].count) > 0) {
        issues.push(
          `${orfaosLogin.rows[0].count} conta(s) de login órfã(s) apontando para alunos inexistentes.`,
        );
      }

      const duplicateMatricula = await db.query(`
                SELECT COUNT(*) as count FROM (
                    SELECT matricula FROM alunos_login GROUP BY matricula HAVING COUNT(*) > 1
                ) sub
            `);
      if (parseInt(duplicateMatricula.rows[0].count) > 0) {
        issues.push(
          `${duplicateMatricula.rows[0].count} matrícula(s) duplicada(s) detectada(s).`,
        );
      }
      break;
    }

    case "aluno_competencias": {
      const orfaosComp = await db.query(`
                SELECT COUNT(*) as count FROM aluno_competencias ac
                LEFT JOIN alunos a ON ac.aluno_id = a.id
                LEFT JOIN competencias c ON ac.competencia_id = c.id
                WHERE a.id IS NULL OR c.id IS NULL
            `);
      if (parseInt(orfaosComp.rows[0].count) > 0) {
        issues.push(
          `${orfaosComp.rows[0].count} avaliação(ões) órfã(s) com aluno ou competência inexistente.`,
        );
      }

      const invalidGrade = await db.query(`
                SELECT COUNT(*) as count FROM aluno_competencias WHERE nota < 0 OR nota > 10
            `);
      if (parseInt(invalidGrade.rows[0].count) > 0) {
        issues.push(
          `${invalidGrade.rows[0].count} nota(s) de competência fora do intervalo [0.0 - 10.0].`,
        );
      }
      break;
    }

    case "tarefas": {
      const orfaosCriador = await db.query(`
                SELECT COUNT(*) as count FROM tarefas t
                LEFT JOIN usuarios u ON t.criado_por = u.id
                WHERE t.criado_por IS NOT NULL AND u.id IS NULL
            `);
      if (parseInt(orfaosCriador.rows[0].count) > 0) {
        issues.push(
          `${orfaosCriador.rows[0].count} tarefa(s) vinculada(s) a criador de usuário inexistente.`,
        );
      }

      const orfaosCompTarefa = await db.query(`
                SELECT COUNT(*) as count FROM tarefas t
                LEFT JOIN competencias c ON t.competencia_id = c.id
                WHERE t.competencia_id IS NOT NULL AND c.id IS NULL
            `);
      if (parseInt(orfaosCompTarefa.rows[0].count) > 0) {
        issues.push(
          `${orfaosCompTarefa.rows[0].count} tarefa(s) referenciando competência inexistente.`,
        );
      }
      break;
    }

    case "tarefas_alunos": {
      const orfaosTarefasAlunos = await db.query(`
                SELECT COUNT(*) as count FROM tarefas_alunos ta
                LEFT JOIN tarefas t ON ta.tarefa_id = t.id
                LEFT JOIN alunos a ON ta.aluno_id = a.id
                WHERE t.id IS NULL OR a.id IS NULL
            `);
      if (parseInt(orfaosTarefasAlunos.rows[0].count) > 0) {
        issues.push(
          `${orfaosTarefasAlunos.rows[0].count} registro(s) de tarefa atribuída órfão(s).`,
        );
      }

      const invalidTaskGrade = await db.query(`
                SELECT COUNT(*) as count FROM tarefas_alunos 
                WHERE nota IS NOT NULL AND (nota < 0 OR nota > 10)
            `);
      if (parseInt(invalidTaskGrade.rows[0].count) > 0) {
        issues.push(
          `${invalidTaskGrade.rows[0].count} nota(s) de tarefa atribuída fora do limite [0.0 - 10.0].`,
        );
      }

      const invalidStatus = await db.query(`
                SELECT COUNT(*) as count FROM tarefas_alunos
                WHERE status NOT IN ('PENDENTE', 'ENTREGUE', 'CONCLUIDA', 'DEVOLVIDA', 'ATRASADA')
            `);
      if (parseInt(invalidStatus.rows[0].count) > 0) {
        issues.push(
          `${invalidStatus.rows[0].count} registro(s) com status de entrega inválido.`,
        );
      }
      break;
    }

    case "usuarios": {
      const invalidCargo = await db.query(`
                SELECT COUNT(*) as count FROM usuarios WHERE cargo NOT IN ('Professor', 'Admin')
            `);
      if (parseInt(invalidCargo.rows[0].count) > 0) {
        issues.push(
          `${invalidCargo.rows[0].count} usuário(s) com cargo inconsistente.`,
        );
      }

      const invalidStatusUser = await db.query(`
                SELECT COUNT(*) as count FROM usuarios WHERE status NOT IN ('ATIVO', 'INATIVO')
            `);
      if (parseInt(invalidStatusUser.rows[0].count) > 0) {
        issues.push(
          `${invalidStatusUser.rows[0].count} usuário(s) com status inconsistente.`,
        );
      }
      break;
    }

    case "solicitacoes_senha": {
      const orfaosSolicitacoes = await db.query(`
                SELECT COUNT(*) as count FROM solicitacoes_senha s
                LEFT JOIN usuarios u ON s.usuario_id = u.id
                WHERE u.id IS NULL
            `);
      if (parseInt(orfaosSolicitacoes.rows[0].count) > 0) {
        issues.push(
          `${orfaosSolicitacoes.rows[0].count} solicitação(ões) de redefinição de usuário inexistente.`,
        );
      }

      const solicitacoesAntigas = await db.query(`
                SELECT COUNT(*) as count FROM solicitacoes_senha
                WHERE status = 'PENDENTE' AND data_solicitacao < (CURRENT_TIMESTAMP - INTERVAL '30 days')
            `);
      if (parseInt(solicitacoesAntigas.rows[0].count) > 0) {
        issues.push(
          `${solicitacoesAntigas.rows[0].count} solicitação(ões) pendente(s) há mais de 30 dias.`,
        );
      }
      break;
    }

    case "notificacoes": {
      const orfaosNotificacoes = await db.query(`
                SELECT COUNT(*) as count FROM notificacoes n
                LEFT JOIN usuarios u ON n.usuario_id = u.id
                LEFT JOIN alunos a ON n.aluno_id = a.id
                WHERE (n.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (n.aluno_id IS NOT NULL AND a.id IS NULL)
                   OR (n.usuario_id IS NULL AND n.aluno_id IS NULL)
            `);
      if (parseInt(orfaosNotificacoes.rows[0].count) > 0) {
        issues.push(
          `${orfaosNotificacoes.rows[0].count} notificação(ões) órfã(s) ou sem destinatário válido.`,
        );
      }
      break;
    }

    case "configuracoes_notificacoes": {
      const orfaosConfig = await db.query(`
                SELECT COUNT(*) as count FROM configuracoes_notificacoes cn
                LEFT JOIN usuarios u ON cn.usuario_id = u.id
                LEFT JOIN alunos a ON cn.aluno_id = a.id
                WHERE (cn.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (cn.aluno_id IS NOT NULL AND a.id IS NULL)
            `);
      if (parseInt(orfaosConfig.rows[0].count) > 0) {
        issues.push(
          `${orfaosConfig.rows[0].count} configuração(ões) de notificação de usuário/aluno inexistente.`,
        );
      }
      break;
    }

    case "ia_conversas": {
      const orfaosConversas = await db.query(`
                SELECT COUNT(*) as count FROM ia_conversas c
                LEFT JOIN usuarios u ON c.usuario_id = u.id
                LEFT JOIN alunos a ON c.aluno_id = a.id
                WHERE (c.usuario_id IS NOT NULL AND u.id IS NULL)
                   OR (c.aluno_id IS NOT NULL AND a.id IS NULL)
                   OR (c.usuario_id IS NULL AND c.aluno_id IS NULL)
            `);
      if (parseInt(orfaosConversas.rows[0].count) > 0) {
        issues.push(
          `${orfaosConversas.rows[0].count} conversa(s) de IA órfã(s).`,
        );
      }
      break;
    }

    case "ia_mensagens": {
      const orfaosMensagens = await db.query(`
                SELECT COUNT(*) as count FROM ia_mensagens m
                LEFT JOIN ia_conversas c ON m.conversa_id = c.id
                WHERE c.id IS NULL
            `);
      if (parseInt(orfaosMensagens.rows[0].count) > 0) {
        issues.push(
          `${orfaosMensagens.rows[0].count} mensagem(ns) de IA pertencentes a conversas inexistentes.`,
        );
      }
      break;
    }
  }

  return {
    table: tableName,
    exists: true,
    totalRows,
    hasIssues: issues.length > 0,
    issuesCount: issues.length,
    issues,
  };
}

/**
 * Executa o reparo e saneamento de uma ou todas as tabelas
 */
async function repairSystem(targetTable = "all") {
  if (targetTable !== "all" && !SYSTEM_TABLES.includes(targetTable)) {
    const error = new Error("Tabela de reparo inválida.");
    error.code = "INVALID_TARGET_TABLE";
    throw error;
  }
  const tablesToRepair = targetTable === "all" ? SYSTEM_TABLES : [targetTable];

  const client = await db.connect();
  const summary = [];

  try {
    await client.query("BEGIN");

    for (const tableName of tablesToRepair) {
      switch (tableName) {
        case "alunos": {
          const fixPresenca = await client.query(`
                        UPDATE alunos 
                        SET presenca = CASE WHEN presenca < 0 THEN 0 ELSE 100 END
                        WHERE presenca < 0 OR presenca > 100
                    `);
          if (fixPresenca.rowCount > 0) {
            summary.push(
              `[alunos] ${fixPresenca.rowCount} registro(s) de presença ajustado(s) para o limite legal (0-100%).`,
            );
          }

          const fixNota = await client.query(`
                        UPDATE alunos 
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota < 0 OR nota > 10
                    `);
          if (fixNota.rowCount > 0) {
            summary.push(
              `[alunos] ${fixNota.rowCount} média(s) fora do intervalo ajustada(s) para valores entre 0.0 e 10.0.`,
            );
          }

          const fixIdade = await client.query(`
                        UPDATE alunos
                        SET idade = CASE WHEN idade < 10 THEN 10 ELSE 20 END
                        WHERE idade < 10 OR idade > 20
                    `);
          if (fixIdade.rowCount > 0) {
            summary.push(
              `[alunos] ${fixIdade.rowCount} idade(s) ajustada(s) para a faixa permitida [10 - 20].`,
            );
          }

          const semLoginRes = await client.query(`
                        SELECT a.id, a.nome FROM alunos a 
                        LEFT JOIN alunos_login al ON a.id = al.aluno_id 
                        WHERE al.id IS NULL
                    `);
          if (semLoginRes.rows.length > 0) {
            for (const aluno of semLoginRes.rows) {
              const matricula = `MAT${String(aluno.id).padStart(5, "0")}`;
              const emailPrefix = aluno.nome
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ".")
                .replace(/\.+/g, ".")
                .slice(0, 30);
              const email = `${emailPrefix}${aluno.id}@escola.com`;
              const defaultPass = `Aluno@${aluno.id}#2026`;
              const hash = await bcrypt.hash(defaultPass, 10);
              await client.query(
                `
                                INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status)
                                VALUES ($1, $2, $3, $4, $5, 'ATIVO')
                                ON CONFLICT DO NOTHING
                            `,
                [aluno.nome, email, hash, matricula, aluno.id],
              );
            }
            summary.push(
              `[alunos_login] Geradas ${semLoginRes.rows.length} nova(s) credencial(is) de acesso para aluno(s) sem login.`,
            );
          }
          break;
        }

        case "alunos_login": {
          const delOrfaosLogin = await client.query(`
                        DELETE FROM alunos_login al
                        WHERE NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = al.aluno_id)
                    `);
          if (delOrfaosLogin.rowCount > 0) {
            summary.push(
              `[alunos_login] ${delOrfaosLogin.rowCount} conta(s) de login órfã(s) sem aluno associado foram removida(s).`,
            );
          }
          break;
        }

        case "aluno_competencias": {
          const delOrfaosComp = await client.query(`
                        DELETE FROM aluno_competencias ac
                        WHERE NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = ac.aluno_id)
                           OR NOT EXISTS (SELECT 1 FROM competencias c WHERE c.id = ac.competencia_id)
                    `);
          if (delOrfaosComp.rowCount > 0) {
            summary.push(
              `[aluno_competencias] ${delOrfaosComp.rowCount} avaliação(ões) órfã(s) removida(s).`,
            );
          }

          const fixNotasComp = await client.query(`
                        UPDATE aluno_competencias
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota < 0 OR nota > 10
                    `);
          if (fixNotasComp.rowCount > 0) {
            summary.push(
              `[aluno_competencias] ${fixNotasComp.rowCount} nota(s) de competência corrigida(s) para o limite [0.0 - 10.0].`,
            );
          }
          break;
        }

        case "tarefas": {
          const fixCriador = await client.query(`
                        UPDATE tarefas t
                        SET criado_por = NULL
                        WHERE t.criado_por IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.criado_por)
                    `);
          if (fixCriador.rowCount > 0) {
            summary.push(
              `[tarefas] ${fixCriador.rowCount} tarefa(s) com criador inexistente foram desvinculadas com segurança.`,
            );
          }

          const fixCompTarefa = await client.query(`
                        UPDATE tarefas t
                        SET competencia_id = NULL
                        WHERE t.competencia_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM competencias c WHERE c.id = t.competencia_id)
                    `);
          if (fixCompTarefa.rowCount > 0) {
            summary.push(
              `[tarefas] ${fixCompTarefa.rowCount} tarefa(s) com competência inexistente foram desvinculadas.`,
            );
          }
          break;
        }

        case "tarefas_alunos": {
          const delOrfaosTA = await client.query(`
                        DELETE FROM tarefas_alunos ta
                        WHERE NOT EXISTS (SELECT 1 FROM tarefas t WHERE t.id = ta.tarefa_id)
                           OR NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = ta.aluno_id)
                    `);
          if (delOrfaosTA.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${delOrfaosTA.rowCount} registro(s) de tarefa atribuída órfão(s) excluído(s).`,
            );
          }

          const fixTaskNotas = await client.query(`
                        UPDATE tarefas_alunos
                        SET nota = CASE WHEN nota < 0 THEN 0.0 ELSE 10.0 END
                        WHERE nota IS NOT NULL AND (nota < 0 OR nota > 10)
                    `);
          if (fixTaskNotas.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${fixTaskNotas.rowCount} nota(s) de tarefa ajustada(s) para a faixa válida [0.0 - 10.0].`,
            );
          }

          const fixStatus = await client.query(`
                        UPDATE tarefas_alunos
                        SET status = 'PENDENTE'
                        WHERE status NOT IN ('PENDENTE', 'ENTREGUE', 'CONCLUIDA', 'DEVOLVIDA', 'ATRASADA')
                    `);
          if (fixStatus.rowCount > 0) {
            summary.push(
              `[tarefas_alunos] ${fixStatus.rowCount} status corrompido(s) redefinido(s) para 'PENDENTE'.`,
            );
          }
          break;
        }

        case "usuarios": {
          const fixCargo = await client.query(`
                        UPDATE usuarios
                        SET cargo = 'Professor'
                        WHERE cargo NOT IN ('Professor', 'Admin')
                    `);
          if (fixCargo.rowCount > 0) {
            summary.push(
              `[usuarios] ${fixCargo.rowCount} usuário(s) com cargo inválido foram redefinidos para 'Professor'.`,
            );
          }

          const fixStatusU = await client.query(`
                        UPDATE usuarios
                        SET status = 'ATIVO'
                        WHERE status NOT IN ('ATIVO', 'INATIVO')
                    `);
          if (fixStatusU.rowCount > 0) {
            summary.push(
              `[usuarios] ${fixStatusU.rowCount} usuário(s) com status corrompido foram ajustados para 'ATIVO'.`,
            );
          }
          break;
        }

        case "solicitacoes_senha": {
          const delOrfaosSol = await client.query(`
                        DELETE FROM solicitacoes_senha s
                        WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = s.usuario_id)
                    `);
          if (delOrfaosSol.rowCount > 0) {
            summary.push(
              `[solicitacoes_senha] ${delOrfaosSol.rowCount} solicitação(ões) de usuário inexistente foram removidas.`,
            );
          }

          const rejAntigas = await client.query(`
                        UPDATE solicitacoes_senha
                        SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP
                        WHERE status = 'PENDENTE' AND data_solicitacao < (CURRENT_TIMESTAMP - INTERVAL '30 days')
                    `);
          if (rejAntigas.rowCount > 0) {
            summary.push(
              `[solicitacoes_senha] ${rejAntigas.rowCount} solicitação(ões) pendente(s) há mais de 30 dias foram encerradas.`,
            );
          }
          break;
        }

        case "notificacoes": {
          const delNotif = await client.query(`
                        DELETE FROM notificacoes n
                        WHERE (n.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = n.usuario_id))
                           OR (n.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = n.aluno_id))
                           OR (n.usuario_id IS NULL AND n.aluno_id IS NULL)
                    `);
          if (delNotif.rowCount > 0) {
            summary.push(
              `[notificacoes] ${delNotif.rowCount} notificação(ões) órfã(s) removida(s).`,
            );
          }
          break;
        }

        case "configuracoes_notificacoes": {
          const delCfg = await client.query(`
                        DELETE FROM configuracoes_notificacoes cn
                        WHERE (cn.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = cn.usuario_id))
                           OR (cn.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = cn.aluno_id))
                    `);
          if (delCfg.rowCount > 0) {
            summary.push(
              `[configuracoes_notificacoes] ${delCfg.rowCount} configuração(ões) de notificação órfã(s) excluída(s).`,
            );
          }
          break;
        }

        case "ia_conversas": {
          const delConv = await client.query(`
                        DELETE FROM ia_conversas c
                        WHERE (c.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = c.usuario_id))
                           OR (c.aluno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM alunos a WHERE a.id = c.aluno_id))
                           OR (c.usuario_id IS NULL AND c.aluno_id IS NULL)
                    `);
          if (delConv.rowCount > 0) {
            summary.push(
              `[ia_conversas] ${delConv.rowCount} conversa(s) de IA órfã(s) removida(s).`,
            );
          }
          break;
        }

        case "ia_mensagens": {
          const delMsg = await client.query(`
                        DELETE FROM ia_mensagens m
                        WHERE NOT EXISTS (SELECT 1 FROM ia_conversas c WHERE c.id = m.conversa_id)
                    `);
          if (delMsg.rowCount > 0) {
            summary.push(
              `[ia_mensagens] ${delMsg.rowCount} mensagem(ns) de IA órfã(s) excluída(s).`,
            );
          }
          break;
        }
      }
    }

    await client.query("COMMIT");

    if (summary.length === 0) {
      summary.push(
        "Nenhuma anomalia ou dado corrompido necessitava de intervenção. A base está completamente íntegra.",
      );
    }

    return {
      success: true,
      changesCount: summary.length,
      summary,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro durante o reparo de banco de dados:", err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SYSTEM_TABLES,
  runSystemCheckup,
  diagnoseTable,
  repairSystem,
};

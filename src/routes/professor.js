const express = require("express");
const router = express.Router();
const { checkAuth, checkAdmin } = require("../middlewares/auth");
const professorController = require("../controllers/professorController");
const tarefaController = require("../controllers/tarefaController");
const calendarioController = require("../controllers/calendarioController");
const aiController = require("../controllers/aiController");

router.get("/dashboard", checkAuth, professorController.dashboard);
router.get("/dashboard/ia", checkAuth, aiController.teacherPage);
router.get("/dashboard/edit", checkAuth, professorController.editAlunos);
router.get("/dashboard/graficos", checkAuth, professorController.graficos);
router.get("/dashboard/equipe", checkAuth, professorController.equipe);
router.post(
  "/dashboard/alterar-senha",
  checkAuth,
  professorController.alterarSenha,
);
router.get(
  "/dashboard/aluno-dados/:id",
  checkAuth,
  professorController.alunoDados,
);
router.post(
  "/dashboard/gerar-senha-aluno/:id",
  checkAuth,
  professorController.gerarSenhaAluno,
);
router.get(
  "/dashboard/competencias-aluno/:id",
  checkAuth,
  professorController.competenciasAluno,
);
router.post(
  "/dashboard/adicionar-competencia",
  checkAuth,
  professorController.adicionarCompetencia,
);
router.post(
  "/dashboard/deletar-competencia/:id",
  checkAuth,
  professorController.deletarCompetencia,
);
router.post(
  "/dashboard/atualizar-presenca",
  checkAuth,
  professorController.atualizarPresenca,
);
router.post("/dashboard/add-aluno", checkAuth, professorController.addAluno);
router.post(
  "/dashboard/delete-aluno/:id",
  checkAuth,
  professorController.deleteAluno,
);
router.post(
  "/dashboard/erase-all",
  checkAuth,
  checkAdmin,
  professorController.eraseAll,
);
router.post(
  "/dashboard/importar-dados",
  checkAuth,
  professorController.importarDados,
);
router.post(
  "/dashboard/importar-dados-completos",
  checkAuth,
  professorController.importarDadosCompletos,
);
router.get(
  "/baixar-modelo-importacao",
  checkAuth,
  professorController.baixarModeloImportacao,
);

router.get("/dashboard/tarefas", checkAuth, tarefaController.listar);
router.post("/dashboard/tarefas/criar", checkAuth, tarefaController.criar);
router.post(
  "/dashboard/tarefas/avaliar-aluno",
  checkAuth,
  tarefaController.avaliarAluno,
);
router.post(
  "/dashboard/tarefas/devolver-aluno",
  checkAuth,
  tarefaController.devolverAluno,
);
router.get("/dashboard/tarefas/:id", checkAuth, tarefaController.obterDetalhes);
router.post(
  "/dashboard/tarefas/editar/:id",
  checkAuth,
  tarefaController.editar,
);
router.post(
  "/dashboard/tarefas/excluir/:id",
  checkAuth,
  tarefaController.excluir,
);
router.post(
  "/dashboard/tarefas/atualizar-status-aluno",
  checkAuth,
  tarefaController.atualizarStatusAluno,
);
router.get(
  "/dashboard/api/tarefas-stats",
  checkAuth,
  tarefaController.estatisticas,
);

router.get("/dashboard/calendario", checkAuth, calendarioController.listar);
router.post(
  "/dashboard/calendario/evento",
  checkAuth,
  calendarioController.criarEvento,
);
router.post(
  "/dashboard/calendario/feriado",
  checkAuth,
  calendarioController.criarFeriado,
);
router.delete(
  "/dashboard/calendario/evento/:id",
  checkAuth,
  calendarioController.deletarEvento,
);
router.delete(
  "/dashboard/calendario/feriado/:id",
  checkAuth,
  calendarioController.deletarFeriado,
);
router.get(
  "/dashboard/api/calendario/mes",
  checkAuth,
  calendarioController.dadosMes,
);

module.exports = router;

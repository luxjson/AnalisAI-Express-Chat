const express = require("express");
const router = express.Router();
const apiController = require("../controllers/apiController");
const aiController = require("../controllers/aiController");
const {
  checkAuth,
  checkAnyAuth,
  checkAlunoAuth,
} = require("../middlewares/auth");
const { rateLimit } = require("../middlewares/security");

router.get("/conta", checkAnyAuth, apiController.getConta);
router.get("/notificacoes", checkAnyAuth, apiController.getNotificacoes);
router.post(
  "/notificacoes/marcar-lida/:id",
  checkAnyAuth,
  apiController.marcarNotificacaoLida,
);
router.post(
  "/notificacoes/marcar-todas-lidas",
  checkAnyAuth,
  apiController.marcarTodasNotificacoesLidas,
);
router.get(
  "/configuracoes-notificacoes",
  checkAnyAuth,
  apiController.getConfiguracoesNotificacoes,
);
router.post(
  "/configuracoes-notificacoes",
  checkAnyAuth,
  apiController.saveConfiguracoesNotificacoes,
);
router.get("/tarefas-stats", checkAuth, apiController.tarefasStats);
router.get(
  "/aluno/dados-grafico",
  checkAlunoAuth,
  apiController.alunoDadosGrafico,
);
router.get(
  "/aluno/ranking-comparativo",
  checkAlunoAuth,
  apiController.alunoRankingComparativo,
);
router.get("/alunos/busca", checkAuth, apiController.buscarAlunos);
router.get("/health", apiController.healthCheck);
router.get("/ia/historico", checkAnyAuth, aiController.history);
router.get("/csrf-token", checkAnyAuth, (req, res) => {
  res.json({
    csrfToken: res.locals.csrfToken || req.session.csrfToken || null,
  });
});
router.patch(
  "/ia/historico/:id",
  checkAnyAuth,
  rateLimit({ windowMs: 60 * 1000, max: 40, keyPrefix: "ai-history-edit" }),
  aiController.updateConversation,
);
router.post(
  "/ia/aluno/chat",
  checkAlunoAuth,
  rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: "ai-student" }),
  aiController.studentChat,
);
router.post(
  "/ia/professor/chat",
  checkAuth,
  rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: "ai-teacher" }),
  aiController.teacherChat,
);
router.post(
  "/ia/professor/aluno/:id/analisar",
  checkAuth,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-student-analysis" }),
  aiController.analyzeStudent,
);
router.post(
  "/ia/professor/alterar-nota",
  checkAuth,
  rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: "ai-grade-update" }),
  aiController.updateGrade,
);
router.get('/', (req, res) => {
    res.render('api', {
        title: 'AnalisAI API',
        baseUrl: `${req.protocol}://${req.get('host')}/api`
    });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController.js");
const { rateLimit } = require("../middlewares/security");

router.get("/", authController.showHome);
router.get("/termos", authController.showTermos);
router.get("/manuais", authController.showManuais);
router.get("/manuais/professor", authController.showManualDeUso);
router.get("/manuais/aluno", authController.showManualDoAluno);
router.get("/login", authController.showLogin);
router.post(
  "/login/professor",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: "login-professor",
  }),
  authController.loginProfessor,
);
router.post(
  "/login/aluno",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login-aluno" }),
  authController.loginAluno,
);
router.post("/logout", authController.logout);
router.get("/esqueci-senha", authController.showEsqueciSenha);
router.post(
  "/esqueci-senha/solicitar",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "forgot-password" }),
  authController.solicitarRedefinicaoSenha,
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { checkAuth, checkAdmin } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

router.get('/dashboard/usuarios', checkAuth, checkAdmin, adminController.listarUsuarios);
router.post('/dashboard/usuarios/add', checkAuth, checkAdmin, adminController.adicionarUsuario);
router.post('/dashboard/usuarios/update', checkAuth, checkAdmin, adminController.atualizarUsuario);
router.post('/dashboard/usuarios/delete/:id', checkAuth, checkAdmin, adminController.deletarUsuario);
router.get('/dashboard/solicitacoes-senha', checkAuth, checkAdmin, adminController.listarSolicitacoesSenha);
router.post('/dashboard/solicitacoes-senha/aprovar/:id', checkAuth, checkAdmin, adminController.aprovarSolicitacaoSenha);
router.post('/dashboard/solicitacoes-senha/rejeitar/:id', checkAuth, checkAdmin, adminController.rejeitarSolicitacaoSenha);
router.post('/dashboard/verify-delete-password', checkAuth, checkAdmin, adminController.verifyDeletePassword);
router.post('/dashboard/checkup/run', checkAuth, checkAdmin, adminController.runCheckup);
router.post('/dashboard/checkup/repair', checkAuth, checkAdmin, adminController.executeRepair);
router.get('/dashboard/checkup/backup-status', checkAuth, checkAdmin, adminController.getBackupInfo);
router.post('/dashboard/checkup/backup-now', checkAuth, checkAdmin, adminController.triggerBackup);
router.get('/dashboard/checkup/download/:filename', checkAuth, checkAdmin, adminController.downloadBackupFile);

module.exports = router;
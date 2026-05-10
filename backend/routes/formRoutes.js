const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware.js');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

const {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  generatePdf,
  nudgeApprover,
} = require('../controllers/formController.js');

router.get('/', authMiddleware, getAllForms);
router.get('/:id', authMiddleware, getFormById);
router.post('/', authMiddleware, createForm);
router.patch('/:id', authMiddleware, updateForm);
router.post('/:id/nudge', authMiddleware, nudgeApprover);
router.post('/:id/pdf', authMiddleware, upload.single('pdfFile'), generatePdf);
router.all('/:id/pdf', authMiddleware, upload.single('pdfFile'), generatePdf);
router.delete('/:id', authMiddleware, deleteForm);

module.exports = router;

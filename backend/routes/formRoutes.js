const express = require('express');
const multer = require('multer');
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
} = require('../controllers/formController.js');

router.get('/', getAllForms);
router.get('/:id', getFormById);
router.post('/', createForm);
router.patch('/:id', updateForm);
router.post('/:id/pdf', upload.single('pdfFile'), generatePdf);
router.all('/:id/pdf', upload.single('pdfFile'), generatePdf);
router.delete('/:id', deleteForm);

module.exports = router;

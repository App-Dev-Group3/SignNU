const express = require('express');
const router = express.Router();

const {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
} = require('../controllers/formController.js');

router.get('/', getAllForms);
router.get('/:id', getFormById);
router.post('/', createForm);
router.patch('/:id', updateForm);
router.delete('/:id', deleteForm);

module.exports = router;

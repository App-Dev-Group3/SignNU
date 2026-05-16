const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController.js');

router.get('/', authMiddleware, adminMiddleware, getDepartments);
router.post('/', authMiddleware, adminMiddleware, createDepartment);
router.put('/:id', authMiddleware, adminMiddleware, updateDepartment);
router.delete('/:id', authMiddleware, adminMiddleware, deleteDepartment);

module.exports = router;

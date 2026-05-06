const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/roleController.js');

router.get('/', authMiddleware, adminMiddleware, getRoles);
router.post('/', authMiddleware, adminMiddleware, createRole);
router.put('/:id', authMiddleware, adminMiddleware, updateRole);
router.delete('/:id', authMiddleware, adminMiddleware, deleteRole);

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} = require('../controllers/organizationController.js');

router.get('/', authMiddleware, adminMiddleware, getOrganizations);
router.post('/', authMiddleware, adminMiddleware, createOrganization);
router.put('/:id', authMiddleware, adminMiddleware, updateOrganization);
router.delete('/:id', authMiddleware, adminMiddleware, deleteOrganization);

module.exports = router;

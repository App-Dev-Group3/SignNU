const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const {
  getOffices,
  createOffice,
  updateOffice,
  deleteOffice,
} = require('../controllers/officeController.js');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, getOffices);
router.post('/', authMiddleware, adminMiddleware, upload.single('imageFile'), createOffice);
router.put('/:id', authMiddleware, adminMiddleware, upload.single('imageFile'), updateOffice);
router.delete('/:id', authMiddleware, adminMiddleware, deleteOffice);

module.exports = router;

const express = require('express');
const router = express.Router();

// Multer setup for handling file uploads (e.g., signature images)
const multer = require('multer');
// Use memory storage for multer to handle file uploads in memory
const storage = multer.memoryStorage();
// Create the multer instance with the defined storage
const upload = multer({ storage });

const {
    getAllUsers,
    getUserById,
    createUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    changePassword,
    requestPasswordReset,
    testSendEmail,
    resetPassword,
    getUserNotifications,
    addUserNotification,
    updateUserNotification,
    updateUser,
    updateUserRole,
    updateSignature,
    updatePdf,
    deleteUser,
} = require('../controllers/userController.js');
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');

router.get('/', authMiddleware, getAllUsers);
router.post('/login', loginUser);
router.post('/forgot-password', requestPasswordReset);
router.post('/test-email', testSendEmail);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);
router.get('/me', authMiddleware, getCurrentUser);
router.post('/logout', authMiddleware, logoutUser);
router.get('/:id/notifications', authMiddleware, getUserNotifications);
router.post('/:id/notifications', authMiddleware, addUserNotification);
router.patch('/:id/notifications/:notificationId', authMiddleware, updateUserNotification);
router.get('/:id', authMiddleware, getUserById);
router.post('/', createUser);
router.patch('/:id', authMiddleware, updateUser);
router.patch('/:id/role', authMiddleware, adminMiddleware, updateUserRole);
router.patch('/:id/signature', upload.single('signatureFile'), updateSignature);
router.patch('/:id/pdf', authMiddleware, upload.single('pdfFile'), updatePdf);
router.post('/:id/pdf', authMiddleware, upload.single('pdfFile'), updatePdf);
router.delete('/:id', authMiddleware, deleteUser);

module.exports = router;

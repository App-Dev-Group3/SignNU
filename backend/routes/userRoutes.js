const express = require('express');
const router = express.Router();

const {
    getAllUsers,
    getUserById,
    createUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    changePassword,
    requestPasswordReset,
    resetPassword,
    getUserNotifications,
    addUserNotification,
    updateUserNotification,
    updateUser,
    updateUserRole,
    deleteUser,
} = require('../controllers/userController.js');
const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');

router.get('/', authMiddleware, adminMiddleware, getAllUsers);
router.post('/login', loginUser);
router.post('/forgot-password', requestPasswordReset);
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
router.delete('/:id', authMiddleware, deleteUser);

module.exports = router;

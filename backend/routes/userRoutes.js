const express = require('express');
const router = express.Router();

const {
    getAllUsers,
    getUserById,
    createUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    getUserNotifications,
    addUserNotification,
    updateUserNotification,
    updateUser,
    deleteUser,
} = require('../controllers/userController.js');
const authMiddleware = require('../middleware/authMiddleware.js');

router.get('/', getAllUsers);
router.post('/login', loginUser);
router.get('/me', authMiddleware, getCurrentUser);
router.post('/logout', authMiddleware, logoutUser);
router.get('/:id/notifications', getUserNotifications);
router.post('/:id/notifications', addUserNotification);
router.patch('/:id/notifications/:notificationId', updateUserNotification);
router.get('/:id', getUserById);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;

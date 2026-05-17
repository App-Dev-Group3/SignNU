const express = require('express');
const router = express.Router();
const { default: rateLimit, ipKeyGenerator } = require('express-rate-limit');

const multer = require('multer');
const storage = multer.memoryStorage();
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
    verifyResetCode,
    testSendEmail,
    testPasswordResetEmail,
    resetPassword,
    getUserNotifications,
    addUserNotification,
    updateUserNotification,
    deleteUserNotification,
    updateUser,
    updateUserRole,
    createRoleRequest,
    getUserRoleRequests,
    updateSignature,
    updatePdf,
    deleteUser,
    getApproverUsers,
    getAvailableRoles,
    getAvailableDepartments,
} = require('../controllers/userController.js');

const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');

// ======================
// RATE LIMITER
// ======================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skip: (req) => {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    },
    message: {
        error: "Too many requests. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req, res) => {
        const email = req.body?.email?.toLowerCase().trim();
        return email || ipKeyGenerator(req, res);
    },
    skip: (req) => {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    },
    message: {
        error: 'Too many password reset requests. Please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const verifyResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req, res) => {
        const email = req.body?.email?.toLowerCase().trim();
        return email || ipKeyGenerator(req, res);
    },
    skip: (req) => {
        const ip = req.ip || '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    },
    message: {
        error: 'Too many verification attempts. Please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ======================
// AUTH ROUTES (RATE LIMITED)
// ======================
router.post('/login', authLimiter, loginUser);
router.post('/', authLimiter, createUser);
router.post('/request-account', authLimiter, createUser);
router.post('/forgot-password', authLimiter, forgotPasswordLimiter, requestPasswordReset);
router.post('/verify-reset-code', verifyResetLimiter, verifyResetCode);

// ======================
// AUTH / USER SESSION ROUTES
// ======================
router.post('/test-email', testSendEmail);
router.post('/test-reset-password', testPasswordResetEmail);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/approvers', authMiddleware, getApproverUsers);
router.get('/roles', authMiddleware, getAvailableRoles);
router.get('/departments', authMiddleware, getAvailableDepartments);
router.post('/logout', authMiddleware, logoutUser);

// ======================
// ADMIN APPROVAL
// ======================
router.put(
    '/approve-user/:id',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const User = require('../models/user.js');

            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.isApproved = true;
            await user.save();

            return res.status(200).json({
                message: 'User approved successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    isApproved: user.isApproved
                }
            });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
);

// ======================
// NOTIFICATIONS
// ======================
router.get('/:id/notifications', authMiddleware, getUserNotifications);
router.post('/:id/notifications', authMiddleware, addUserNotification);
router.patch('/:id/notifications/:notificationId', authMiddleware, updateUserNotification);
router.delete('/:id/notifications/:notificationId', authMiddleware, deleteUserNotification);

router.post('/:id/role-requests', authMiddleware, createRoleRequest);
router.get('/:id/role-requests', authMiddleware, getUserRoleRequests);

// ======================
// USER MANAGEMENT
// ======================
router.get('/', authMiddleware, adminMiddleware, getAllUsers);
router.get('/:id', authMiddleware, getUserById);
router.patch('/:id', authMiddleware, updateUser);
router.patch('/:id/role', authMiddleware, adminMiddleware, updateUserRole);

// ======================
// FILE UPLOADS
// ======================
router.patch('/:id/signature', upload.single('signatureFile'), updateSignature);
router.patch('/:id/pdf', authMiddleware, upload.single('pdfFile'), updatePdf);
router.post('/:id/pdf', authMiddleware, upload.single('pdfFile'), updatePdf);

// ======================
// DELETE USER
// ======================
router.delete('/:id', authMiddleware, deleteUser);

module.exports = router;
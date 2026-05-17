const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware.js');
const adminMiddleware = require('../middleware/adminMiddleware.js');
const User = require('../models/user.js');
const AccountRequest = require('../models/accountRequest.js');
const {
    getAllPendingRoleRequests,
    approveRoleRequest,
    rejectRoleRequest,
} = require('../controllers/userController.js');

const ensureUniqueUsername = async (baseUsername) => {
    const cleanBase = (baseUsername || 'user').trim();
    let candidate = cleanBase;
    let counter = 1;

    while (await User.findOne({ username: candidate })) {
        counter += 1;
        candidate = `${cleanBase} ${counter}`;
    }

    return candidate;
};

// ===============================
// APPROVE USER (ADMIN ONLY)
// ===============================
router.put(
    '/approve-user/:id',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.isApproved = true;
            await user.save();

            res.status(200).json({
                message: 'User approved successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    isApproved: user.isApproved
                }
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Alternative route matching frontend expectation
router.put(
    '/:id/approve',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.isApproved = true;
            await user.save();

            res.status(200).json({
                message: 'User approved successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    isApproved: user.isApproved
                }
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// ===============================
// ACCOUNT REQUESTS (ADMIN ONLY)
// ===============================
router.get(
    '/account-requests',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const { status = 'pending' } = req.query;
            const query = status === 'all' ? {} : { status };

            const requests = await AccountRequest.find(query)
                .sort({ created_at: -1 })
                .select('-password');

            return res.status(200).json(requests);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
);

router.put(
    '/account-requests/:id/approve',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const request = await AccountRequest.findById(req.params.id);
            if (!request) {
                return res.status(404).json({ error: 'Account request not found' });
            }

            if (request.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending requests can be approved' });
            }

            const existingUser = await User.findOne({ email: request.email });
            if (existingUser) {
                return res.status(409).json({ error: 'A user with this email already exists' });
            }

            const username = await ensureUniqueUsername(request.username || `${request.firstName} ${request.lastName}`);

            const user = await User.create({
                firstName: request.firstName,
                middleInitial: request.middleInitial,
                lastName: request.lastName,
                username,
                email: request.email,
                password: request.password,
                role: request.role,
                roles: [request.role],
                userType: request.userType || 'Employee',
                isCouncilMember: !!request.isCouncilMember,
                councilRole: request.councilRole,
                employeeRole: request.employeeRole,
                department: request.department,
                organization: request.organization,
                isApproved: true,
            });

            request.status = 'approved';
            request.reviewedBy = req.user.id;
            request.reviewedAt = new Date();
            await request.save();

            const safeUser = user.toObject();
            delete safeUser.password;

            const io = req.app?.get('io');
            if (io) {
                io.emit('account-request:status-changed', {
                    _id: request._id,
                    status: request.status,
                });
            }

            return res.status(200).json({
                message: 'Account request approved and user created',
                user: safeUser,
                request: {
                    id: request._id,
                    status: request.status,
                },
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
);

router.put(
    '/account-requests/:id/reject',
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const request = await AccountRequest.findById(req.params.id);
            if (!request) {
                return res.status(404).json({ error: 'Account request not found' });
            }

            if (request.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending requests can be rejected' });
            }

            request.status = 'rejected';
            request.reviewedBy = req.user.id;
            request.reviewedAt = new Date();
            request.reviewNote = (req.body?.note || '').toString().trim() || undefined;
            await request.save();

            const io = req.app?.get('io');
            if (io) {
                io.emit('account-request:status-changed', {
                    _id: request._id,
                    status: request.status,
                });
            }

            return res.status(200).json({
                message: 'Account request rejected',
                request: {
                    id: request._id,
                    status: request.status,
                },
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
);

router.get(
    '/role-requests',
    authMiddleware,
    adminMiddleware,
    getAllPendingRoleRequests
);

router.put(
    '/role-requests/:userId/:requestId/approve',
    authMiddleware,
    adminMiddleware,
    approveRoleRequest
);

router.put(
    '/role-requests/:userId/:requestId/reject',
    authMiddleware,
    adminMiddleware,
    rejectRoleRequest
);

module.exports = router;
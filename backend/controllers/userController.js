const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Resend } = require('resend');
const User = require('../models/user.js');
const AccountRequest = require('../models/accountRequest.js');
const { validateAccountRequest } = require('../models/accountRequest.js');
const Role = require('../models/role.js');
const cloudinary = require('cloudinary').v2;

const allowedSignnuEmailPattern = /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/;

const isAllowedSignnuEmail = (email) => {
    return allowedSignnuEmailPattern.test((email || '').toLowerCase().trim());
};

const isValidPassword = (password) => {
    return /^(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,}$/.test(password);
};

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@signnu.work';
const TEST_EMAIL = process.env.TEST_EMAIL || 'signnu.official@gmail.com';

const canAccessUser = (req, targetId) => req.user.id === targetId || req.user.role === 'Admin';

const emitAccountRequestEvent = (req, request) => {
    try {
        const io = req.app?.get('io');
        if (!io) return;
        const payload = request.toObject ? request.toObject() : { ...request };
        if (payload.password) delete payload.password;
        io.emit('account-request:new', payload);
    } catch (error) {
        console.warn('Failed to emit account-request:new', error?.message || error);
    }
};

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            username: user.username,
            name: user.username,
        },
        process.env.JWT_SECRET || 'secret123',
        { expiresIn: '1h' }
    );
};

// Return "https" URLs by setting secure: true
cloudinary.config({
  secure: true
});

// Log the configuration
// console.log(cloudinary.config());

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ created_at: -1 }).select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getApproverUsers = async (_req, res) => {
    try {
        const users = await User.find({ isApproved: true })
            .sort({ username: 1 })
            .select('_id username email role department isApproved');

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single user by ID
const getUserById = async (req, res) => {
    const { id } = req.params;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ error: 'Invalid ID format' });
    }
};

// Create a new user
const createUser = async (req, res) => {
    const { firstName, middleInitial, mi, lastName, username, email, password, role, department, organization, notifications } = req.body;
    try {
        const normalizedEmail = (email || '').toLowerCase().trim();
        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const existingRequest = await AccountRequest.findOne({ email: normalizedEmail });
        if (existingRequest && existingRequest.status === 'pending') {
            return res.status(409).json({
                error: 'Email is pending admin approval',
                pending: true,
            });
        }
        if (existingRequest && existingRequest.status === 'approved') {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const normalizedFirstName = (firstName || '').trim();
        const normalizedLastName = (lastName || '').trim();
        const normalizedMi = (middleInitial ?? mi ?? '').toString().trim();

        if (!normalizedFirstName || !normalizedLastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        const fullName = username || [normalizedFirstName, normalizedLastName, normalizedMi]
          .filter((part) => part && part.toString().trim().length > 0)
          .join(' ');
        const requestPayload = {
            firstName: normalizedFirstName,
            middleInitial: normalizedMi,
            lastName: normalizedLastName,
            username: fullName,
            email: normalizedEmail,
            password,
            role,
            department,
            organization,
            notifications,
            status: 'pending',
        };

        const { error, value } = validateAccountRequest(requestPayload);
        if (error) {
            return res.status(400).json({
                error: 'Invalid account request data',
                details: error.details.map((detail) => detail.message),
            });
        }

        const hashedPassword = await bcrypt.hash(value.password, 10);

        if (existingRequest && existingRequest.status === 'rejected') {
            existingRequest.firstName = value.firstName;
            existingRequest.middleInitial = value.middleInitial;
            existingRequest.lastName = value.lastName;
            existingRequest.username = value.username;
            existingRequest.password = hashedPassword;
            existingRequest.role = value.role;
            existingRequest.department = value.department;
            existingRequest.organization = value.organization;
            existingRequest.status = 'pending';
            existingRequest.reviewedBy = undefined;
            existingRequest.reviewedAt = undefined;
            existingRequest.reviewNote = undefined;
            await existingRequest.save();
            emitAccountRequestEvent(req, existingRequest);

            return res.status(201).json({
                message: 'Account request submitted and pending admin approval',
                pending: true,
                request: {
                    id: existingRequest._id,
                    email: existingRequest.email,
                    status: existingRequest.status,
                },
            });
        }

        const request = await AccountRequest.create({
            firstName: value.firstName,
            middleInitial: value.middleInitial,
            lastName: value.lastName,
            username: value.username,
            email: value.email,
            password: hashedPassword,
            role: value.role,
            department: value.department,
            organization: value.organization,
            notifications,
            status: value.status,
        });
        emitAccountRequestEvent(req, request);

        return res.status(201).json({
            message: 'Account request submitted and pending admin approval',
            pending: true,
            request: {
                id: request._id,
                email: request.email,
                status: request.status,
            },
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Login a user
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            const pendingRequest = await AccountRequest.findOne({
                email: email.toLowerCase().trim(),
                status: 'pending',
            });

            if (pendingRequest) {
                return res.status(403).json({
                    error: 'Email is pending admin approval',
                    pending: true,
                });
            }

            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 🔒 NEW: APPROVAL CHECK (ADD THIS)
        if (!user.isApproved) {
            return res.status(403).json({
                error: 'Email is pending admin approval',
                pending: true,
            });
        }

        const safeUser = user.toObject();
        delete safeUser.password;

        const token = generateToken(user);

        req.session.user = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            username: user.username,
            name: user.username,
        };

        res.cookie('auth_token', token, {
            httpOnly: true,
            // Allow cross-site cookie in production (frontend on a different domain)
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 1000, // 1 hour
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: safeUser
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get current user from JWT
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const safeUser = user.toObject();
        delete safeUser.password;
        res.status(200).json({ user: safeUser });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const logoutUser = async (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
            }

            res.clearCookie(process.env.SESSION_COOKIE_NAME || 'signnu_session', {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production',
            });

            res.clearCookie('auth_token', {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production',
            });

            return res.status(200).json({ message: 'Logout successful' });
        });
    } else {
        res.clearCookie(process.env.SESSION_COOKIE_NAME || 'signnu_session', {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production',
        });

        res.clearCookie('auth_token', {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production',
        });

        res.status(200).json({ message: 'Logout successful' });
    }
};

const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'oldPassword and newPassword are required' });
    }
    if (!isValidPassword(newPassword)) {
        return res.status(400).json({ error: 'New password must be at least 8 characters, alphanumeric, and include an uppercase letter' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        if (!isAllowedSignnuEmail(normalizedEmail)) {
            return res.status(400).json({
                error: 'Email must end with @nu-laguna.edu.ph, @students.nu-laguna.edu.ph, or @shs.students.nu-laguna.edu.ph',
            });
        }

        const user = await User.findOne({ email: normalizedEmail });

        if (user) {
            const code = String(Math.floor(100000 + Math.random() * 900000));
            const token = crypto.randomBytes(32).toString('hex');
            const expires = Date.now() + 3 * 60 * 1000; // 3 minutes

            user.passwordResetCode = code;
            user.passwordResetCodeExpires = expires;
            user.passwordResetToken = token;
            user.passwordResetTokenExpires = expires;
            await user.save();

            const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
            if (resendClient) {
                console.log('Sending password reset email', {
                    from: EMAIL_FROM,
                    to: normalizedEmail,
                    subject: 'SignNU Password Reset',
                    resetUrl,
                    code,
                });
                await resendClient.emails.send({
                    from: EMAIL_FROM,
                    to: normalizedEmail,
                    subject: 'SignNU Password Reset',
                    html: `<p>We received a request to reset your SignNU password.</p><p>Your 6-digit password reset code is <strong>${code}</strong>.</p><p>This code expires in 3 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
                    text: `Your SignNU password reset code is ${code}. It expires in 3 minutes.`,
                });
                console.log('Password reset email send request completed successfully.');
            } else {
                console.warn('RESEND_API_KEY is not configured. Skipping password reset email.');
            }
        }

        res.status(200).json({ message: 'If that email exists, a password reset code has been sent.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const verifyResetCode = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and reset code are required' });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        if (!isAllowedSignnuEmail(normalizedEmail)) {
            return res.status(400).json({ error: 'Invalid reset request' });
        }

        const user = await User.findOne({
            email: normalizedEmail,
            passwordResetCode: code,
            passwordResetCodeExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        res.status(200).json({ valid: true, message: 'Reset code verified' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const testSendEmail = async (req, res) => {
    const { email, subject, html, text } = req.body;
    // Use request email if provided, otherwise fall back to TEST_EMAIL
    const toEmail = (email || TEST_EMAIL || '').toString().trim();
    if (!toEmail) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    if (!resendClient) {
        return res.status(500).json({ error: 'Resend API key is not configured.' });
    }

    try {
        console.log('Sending test email', {
            from: EMAIL_FROM,
            to: toEmail,
            subject: subject || 'SignNU Test Email',
        });
        const sendResponse = await resendClient.emails.send({
            from: EMAIL_FROM,
            to: [toEmail],
            subject: subject || 'SignNU Test Email',
            html: html || '<strong>This is a SignNU test email.</strong>',
            text: text || 'This is a SignNU test email.',
        });
        console.log('Test email send request completed successfully:', sendResponse);

        return res.status(200).json({ success: true, response: sendResponse });
    } catch (error) {
        console.error('Test send email failed:', {
            error: error?.message || error,
            stack: error?.stack,
            request: {
                from: EMAIL_FROM,
                to: toEmail,
                subject: subject || 'SignNU Test Email',
            },
        });
        return res.status(error?.statusCode || 500).json({
            error: error?.message || 'Failed to send test email.',
            details: error,
        });
    }
};

const testPasswordResetEmail = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = (email || TEST_EMAIL || '').toLowerCase().trim();

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    if (!resendClient) {
        return res.status(500).json({ error: 'Resend API key is not configured.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ error: 'No user found for that email address.' });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3 * 60 * 1000; // 3 minutes

        user.passwordResetCode = code;
        user.passwordResetCodeExpires = expires;
        user.passwordResetToken = token;
        user.passwordResetTokenExpires = expires;
        await user.save();

        const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

        console.log('Sending test password reset email', {
            from: EMAIL_FROM,
            to: normalizedEmail,
            subject: 'SignNU Test Password Reset',
            resetUrl,
            code,
        });

        const sendResponse = await resendClient.emails.send({
            from: EMAIL_FROM,
            to: normalizedEmail,
            subject: 'SignNU Test Password Reset',
            html: `<p>This is a test password reset email from SignNU.</p><p>Your 6-digit test reset code is <strong>${code}</strong>.</p><p>This code expires in 3 minutes.</p><p>If you did not request this, ignore this email.</p>`,
            text: `Your 6-digit test reset code is ${code}. It expires in 3 minutes.`,
        });

        console.log('Test password reset email sent successfully:', sendResponse);

        return res.status(200).json({
            success: true,
            message: 'Test password reset email sent.',
            resetUrl,
            response: sendResponse,
        });
    } catch (error) {
        console.error('Test password reset email failed:', {
            error: error?.message || error,
            stack: error?.stack,
            email: normalizedEmail,
        });
        return res.status(error?.statusCode || 500).json({
            error: error?.message || 'Failed to send test password reset email.',
            details: error,
        });
    }
};

const resetPassword = async (req, res) => {
    const { token, code, email, newPassword } = req.body;
    if ((!token && !code) || !newPassword) {
        return res.status(400).json({ error: 'token or code and newPassword are required' });
    }

    if (!token && !email) {
        return res.status(400).json({ error: 'Email is required when using a reset code' });
    }

    if (!isValidPassword(newPassword)) {
        return res.status(400).json({ error: 'New password must be at least 8 characters, alphanumeric, and include an uppercase letter' });
    }

    try {
        const query = {
            passwordResetTokenExpires: { $gt: Date.now() },
        };

        if (token) {
            query.passwordResetToken = token;
        } else {
            const normalizedEmail = email.toLowerCase().trim();
            query.email = normalizedEmail;
            query.passwordResetCode = code;
            query.passwordResetCodeExpires = { $gt: Date.now() };
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token/code' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        user.passwordResetCode = undefined;
        user.passwordResetCodeExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getUserNotifications = async (req, res) => {
    const { id } = req.params;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const notifications = (user.notifications || []).map((notification) => ({
            id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            formId: notification.formId || '',
            userId: notification.userId || user._id.toString(),
            message: notification.message,
            createdAt: notification.createdAt ? notification.createdAt.toISOString() : (notification.created_at ? notification.created_at.toISOString() : new Date().toISOString()),
            read: typeof notification.read === 'boolean' ? notification.read : notification.is_read || false,
        }));
        res.status(200).json(notifications);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const addUserNotification = async (req, res) => {
    const { id } = req.params;
    const { formId, userId, message } = req.body;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const notification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            formId,
            userId,
            message,
            read: false,
            createdAt: new Date(),
        };
        user.notifications = [notification, ...(user.notifications || [])];
        await user.save();
        emitNotificationToUser(req, id, notification);
        res.status(201).json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateUserNotification = async (req, res) => {
    const { id, notificationId } = req.params;
    const { read } = req.body;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const notification = (user.notifications || []).find((notification) => notification.id === notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (typeof read === 'boolean') {
            notification.read = read;
        }
        await user.save();
        res.status(200).json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteUserNotification = async (req, res) => {
    const { id, notificationId } = req.params;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const notificationIndex = (user.notifications || []).findIndex((notification) => notification.id === notificationId);
        if (notificationIndex === -1) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const deletedNotification = user.notifications.splice(notificationIndex, 1)[0];
        await user.save();
        res.status(200).json({ message: 'Notification dismissed', notification: deletedNotification });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update a user
const updateUser = async (req, res) => {
    const { id } = req.params;
    try {
        if (!canAccessUser(req, id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const payload = { ...req.body };

        if (payload.roles) {
            if (!Array.isArray(payload.roles)) {
                return res.status(400).json({ error: 'Invalid roles format' });
            }
            payload.roles = payload.roles
                .map((role) => role?.toString?.().trim?.())
                .filter((role) => typeof role === 'string' && role.length > 0);
            if (!payload.roles.length) {
                return res.status(400).json({ error: 'Invalid roles' });
            }
            if (!payload.role) {
                payload.role = payload.roles[0];
            }
        }

        if (payload.password) {
            const targetUser = await User.findById(id);
            if (!targetUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (req.user.role !== 'Admin') {
                const { oldPassword } = req.body;
                if (!oldPassword) {
                    return res.status(400).json({ error: 'Current password is required to change password' });
                }
                const isMatch = await bcrypt.compare(oldPassword, targetUser.password);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Invalid current password' });
                }
            }

            payload.password = await bcrypt.hash(payload.password, 10);
            delete payload.oldPassword;
        }

        const user = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !role.trim()) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const roleExists = await Role.exists({ name: role.trim() });
        if (!roleExists) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.role = role.trim();
        user.roles = Array.from(new Set([role.trim(), ...(user.roles || [])]));
        await user.save();

        const safeUser = user.toObject();
        delete safeUser.password;
        res.status(200).json(safeUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Upload to Cloudinary
const uploadToCloudinary = (buffer, id) => {
    // Use a Promise to handle the asynchronous upload
    // Resolve with the secure URL of the uploaded image or reject with an error
    return new Promise((resolve, reject) => {
        // Use the upload_stream method to upload the file buffer directly
        const uploadStream = cloudinary.uploader.upload_stream(
        {
            // Store each user's uploads in their own folder
            folder: `signatures/${id}`,
            resource_type: 'auto',
            transformation: [{ width: 300, height: 100, crop: 'fit' }],
            public_id: 'signature'
        },
        // Callback function to handle the upload result
        (error, result) => {
            if (error) reject(error);
            else resolve(result);
        }
        );
        // End the upload stream with the signature file buffer
        uploadStream.end(buffer);
    });
};

const sanitizePublicId = (filename) => {
    const baseName = path.parse(filename).name;
    return baseName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 200) || 'document';
};

const uploadRawToCloudinary = (buffer, id, filename) => {
    const publicId = `${sanitizePublicId(filename)}_${Date.now()}`;
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
        {
            resource_type: 'raw',
            folder: `pdfs/${id}`,
            allowed_formats: ['pdf'],
            public_id: publicId,
        },
        (error, result) => {
            if (error) reject(error);
            else resolve(result);
        }
        );
        uploadStream.end(buffer);
    });
};

// Detect image MIME type from buffer using magic numbers
const detectImageMime = (buffer) => {
    if (!buffer || buffer.length < 12) return null;
    
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    let isPng = true;
    for (let i = 0; i < pngSignature.length; i++) {
        if (buffer[i] !== pngSignature[i]) {
            isPng = false;
            break;
        }
    }
    if (isPng) return 'image/png';
    
    // JPEG magic: first two bytes 0xFF 0xD8
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        // Optionally check for Exif/JFIF header, but the first two bytes are enough
        return 'image/jpeg';
    }
    
    return null;
};

// Update user signature
const updateSignature = async (req, res) => {
    const { id } = req.params;
    const signatureFile = req.file;
    const { signatureData } = req.body;

    let buffer;

    if (signatureFile) {
        buffer = signatureFile.buffer;
    } 
    else if (signatureData) {
        // Extract the base64 data from the signatureData string
        const matches = signatureData.match(/^data:image\/png;base64,(.+)$/);

    if (!matches) {
        return res.status(400).json({
        error: 'Invalid signature data. Expected base64 PNG.'
        });
    }
    // Convert the base64 string to a buffer
    buffer = Buffer.from(matches[1], 'base64');
    } 
    else {
        return res.status(400).json({
            error: 'No signature provided. Upload a file or draw a signature.'
        });
    }

    const detectedMime = detectImageMime(buffer);
    
    if (!detectedMime || (detectedMime !== 'image/png' && detectedMime !== 'image/jpeg')) {
        return res.status(400).json({
            error: 'Invalid file type. Only PNG and JPEG images are allowed (based on file content).'
        });
    }

    const uploadResult = await uploadToCloudinary(buffer, id);

    const uploadedSignatureURL = uploadResult.secure_url;

    await User.findByIdAndUpdate(id, { signatureURL: uploadedSignatureURL });

    res.status(200).json({
        message: 'Signature updated successfully',
        signatureURL: uploadedSignatureURL
    });
};

const updatePdf = async (req, res) => {
    const { id } = req.params;
    const pdfFile = req.file;

    if (!pdfFile) {
        return res.status(400).json({ error: 'No PDF file provided. Use form field pdfFile.' });
    }

    const uploadResult = await uploadRawToCloudinary(pdfFile.buffer, id, pdfFile.originalname);
    const uploadedPdfURL = uploadResult.secure_url;

    await User.findByIdAndUpdate(id, { pdfURL: uploadedPdfURL });

    res.status(200).json({
        message: 'PDF uploaded successfully',
        pdfURL: uploadedPdfURL,
        public_id: uploadResult.public_id,
        folder: uploadResult.folder,
    });
};

// Delete a user
const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (!canAccessUser(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully', user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getAvailableRoles = async (_req, res) => {
    try {
        const managedRoles = await Role.find({}).sort({ name: 1 });
        if (managedRoles.length > 0) {
            return res.status(200).json(managedRoles.map((role) => role.name));
        }

        const roles = await User.distinct('role', { isApproved: true });
        const filteredRoles = roles
            .filter(role => role && role.trim() && role !== 'Student')
            .sort();
        res.status(200).json(filteredRoles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAvailableDepartments = async (_req, res) => {
    try {
        const departments = await User.distinct('department', { isApproved: true });
        const filteredDepartments = departments
            .filter(dept => dept && dept.trim())
            .sort();
        res.status(200).json(filteredDepartments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
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
    updateSignature,
    updatePdf,
    deleteUser,
    getApproverUsers,
    getAvailableRoles,
    getAvailableDepartments,
};

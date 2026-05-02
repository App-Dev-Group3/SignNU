const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Resend } = require('resend');
const User = require('../models/user.js');
const cloudinary = require('cloudinary').v2;

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@signnu.work';

const canAccessUser = (req, targetId) => req.user.id === targetId || req.user.role === 'Admin';

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
console.log(cloudinary.config());

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ created_at: -1 }).select('-password');
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
    const { username, email, password, role, department, notifications } = req.body;
    try {
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role,
            department,
            notifications,
        });

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
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 1000, // 1 hour
        });

        res.status(201).json({ message: 'User created', token, user: safeUser });
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
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
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
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 1000, // 1 hour
        });

        res.status(200).json({ message: 'Login successful', token, user: safeUser });
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
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
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
        const user = await User.findOne({ email: normalizedEmail });

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            user.passwordResetToken = token;
            user.passwordResetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
            await user.save();

            const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
            if (resendClient) {
                await resendClient.emails.send({
                    from: EMAIL_FROM,
                    to: normalizedEmail,
                    subject: 'SignNU Password Reset',
                    html: `<p>We received a request to reset your SignNU password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, please ignore this email.</p>`,
                });
            } else {
                console.warn('RESEND_API_KEY is not configured. Skipping password reset email.');
            }
        }

        res.status(200).json({ message: 'If that email exists, a password reset link has been sent.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const testSendEmail = async (req, res) => {
    const { email, subject, html, text } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    if (!resendClient) {
        return res.status(500).json({ error: 'Resend API key is not configured.' });
    }

    try {
        const sendResponse = await resendClient.emails.send({
            from: EMAIL_FROM,
            to: [email],
            subject: subject || 'SignNU Test Email',
            html: html || '<strong>This is a SignNU test email.</strong>',
            text: text || 'This is a SignNU test email.',
        });

        return res.status(200).json({ success: true, response: sendResponse });
    } catch (error) {
        console.error('Test send email failed:', error);
        return res.status(error?.statusCode || 500).json({
            error: error?.message || 'Failed to send test email.',
            details: error,
        });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'token and newPassword are required' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
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

// Update a user
const updateUser = async (req, res) => {
    const { id } = req.params;
    try {
        if (!canAccessUser(req, id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const payload = { ...req.body };
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
    const validRoles = [
        'Department Head',
        'Dean',
        'Faculty',
        'Staff',
        'Student',
        'Finance Officer',
        'Procurement Officer',
        'VP for Academics',
        'VP for Finance',
        'Requester',
        'Signatory',
        'Reviewer',
        'Admin',
    ];

    if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
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

module.exports = {
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
};

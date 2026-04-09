const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.js');

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET || 'secret123',
        { expiresIn: '1h' }
    );
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ created_at: -1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single user by ID
const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
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

const getUserNotifications = async (req, res) => {
    const { id } = req.params;
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
        const payload = { ...req.body };
        if (payload.password) {
            payload.password = await bcrypt.hash(payload.password, 10);
        }
        const user = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete a user
const deleteUser = async (req, res) => {
    const { id } = req.params;
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
    getUserNotifications,
    addUserNotification,
    updateUserNotification,
    updateUser,
    deleteUser,
};

const jwt = require('jsonwebtoken');
const User = require('../models/user.js');

const parseCookies = (cookieHeader = '') =>
    cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, ...rest] = cookie.split('=');
        if (!name) return cookies;
        cookies[name.trim()] = decodeURIComponent(rest.join('='));
        return cookies;
    }, {});

const authMiddleware = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user.id).select('status');
            if (!user) {
                return res.status(401).json({ error: 'Invalid session user' });
            }
            if (user.status === 'deactivated') {
                return res.status(403).json({ error: 'Account is deactivated' });
            }
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        req.user = req.session.user;
        return next();
    }

    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else {
        const cookies = parseCookies(req.headers.cookie || '');
        token = cookies.auth_token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        const user = await User.findById(payload.id).select('status');
        if (!user) {
            return res.status(401).json({ error: 'Invalid token user' });
        }
        if (user.status === 'deactivated') {
            return res.status(403).json({ error: 'Account is deactivated' });
        }
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;

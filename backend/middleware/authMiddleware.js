const jwt = require('jsonwebtoken');

const parseCookies = (cookieHeader = '') =>
    cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, ...rest] = cookie.split('=');
        if (!name) return cookies;
        cookies[name.trim()] = decodeURIComponent(rest.join('='));
        return cookies;
    }, {});

const authMiddleware = (req, res, next) => {
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
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;

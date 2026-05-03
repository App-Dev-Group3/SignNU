const rateLimit = require('express-rate-limit');

// used for login / register / forgot-password
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // max 5 requests per IP
    message: {
        error: 'Too many requests. Please try again after 15 minutes.'
    }
});

module.exports = { authLimiter };
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const approvalRoutes = require('./routes/route');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const formRoutes = require('./routes/formRoutes');
const messageRoutes = require('./routes/messageRoutes');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const PORT = process.env.PORT || 4000;

// Import the promises-based version of Node.js's DNS module const 
dns = require("node:dns/promises"); 

// Configures the DNS servers that Node.js will use for all subsequent DNS lookups 
// Cloudflare + Google DNS 
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// 2. ENABLE CORS (Place this before your routes!)
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})); 

// 3. Session middleware
app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || 'signnu_session',
    secret: process.env.SESSION_SECRET || 'secret123',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    },
  })
);

// 1. JSON Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} request to: ${req.path}`);
    next();
});

// 3. API Routes
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/messages', messageRoutes);

// 4. Base Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the SignNU API' });
});

// 5. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 6. 404 Handler (JSON format)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// 7. Connect to MongoDB & Start Server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Connected to DB & Server running on port ${PORT}`);
            console.log(`💬 For chatbot: Run 'node summary.js' on port 5000`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
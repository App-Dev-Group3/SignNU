require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // 1. REQUIRE CORS AT THE TOP
const approvalRoutes = require('./routes/route');
const userRoutes = require('./routes/userRoutes');
const formRoutes = require('./routes/formRoutes');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const PORT = process.env.PORT || 4000;

// 2. ENABLE CORS (Place this before your routes!)
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
})); 

// 1. JSON Parser Middleware
app.use(express.json());

// 2. Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} request to: ${req.path}`);
    next();
});

// 3. API Routes
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/forms', formRoutes);

// 4. Base Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the SignNU API' });
});

// 5. 404 Handler (JSON format)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// 6. Connect to MongoDB & Start Server
const rawMongoUri = process.env.MONGO_URI;
if (!rawMongoUri) {
    console.error('MONGO_URI is not set. Please add it to your .env file.');
    process.exit(1);
}

const ensureMongoDatabase = (uri) => {
    try {
        const parsed = new URL(uri);
        const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
        if (!dbName) {
            const defaultDb = 'SignNU';
            console.warn(`MONGO_URI does not specify a database. Using default database '${defaultDb}'. Please update your .env to include '/${defaultDb}'.`);
            return uri.replace(/(mongodb(?:\+srv)?:\/\/[^\/]+)(\/?)(\?.*)?$/, `$1/${defaultDb}$3`);
        }
        return uri;
    } catch (err) {
        return uri;
    }
};

const mongoUri = ensureMongoDatabase(rawMongoUri);

mongoose.connect(mongoUri)
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Connected to DB & Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
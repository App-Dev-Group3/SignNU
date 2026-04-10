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
  allowedHeaders: ['Content-Type', 'Authorization'],
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
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Connected to DB & Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
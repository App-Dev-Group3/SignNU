require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const approvalRoutes = require('./routes/route');
const userRoutes = require('./routes/userRoutes');
const formRoutes = require('./routes/formRoutes');
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

// File upload configuration for chatbot
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// Initialize Gemini AI
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.warn('⚠️ Warning: GEMINI_API_KEY not found in environment variables');
}
const genAI = new GoogleGenerativeAI(geminiKey || '');

// 2. Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} request to: ${req.path}`);
    next();
});

// 3. API Routes
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/forms', formRoutes);

// 4. AI Chatbot Route
app.post('/chat', upload.single('pdf'), async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage && !req.file) {
            return res.status(400).json({ error: "Please provide a message or upload a PDF" });
        }

        // Get the model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Build content array for Gemini
        const contents = [];
        
        if (userMessage) {
            contents.push({
                role: "user",
                parts: [{
                    text: `You are a helpful AI assistant specialized in digital signatures and form processing. 
                    Answer the user's question clearly and concisely, focusing on digital signatures, form workflows, and document handling.
                    User question: ${userMessage}`
                }]
            });
        }

        if (req.file) {
            const base64Data = req.file.buffer.toString("base64");
            contents.push({
                role: "user",
                parts: [{
                    inlineData: {
                        mimeType: req.file.mimetype || 'application/pdf',
                        data: base64Data
                    }
                }]
            });
            
            if (userMessage) {
                contents.push({
                    role: "user",
                    parts: [{
                        text: `Also, please analyze this document in the context of my question: ${userMessage}`
                    }]
                });
            } else {
                contents.push({
                    role: "user",
                    parts: [{
                        text: "Please analyze this document and provide a summary."
                    }]
                });
            }
        }

        const response = await model.generateContent({
        contents: contents
        });

        // Safely extract reply text
        const aiReply = response.response.text() || "I couldn't generate a response. Please try again.";

        res.json({ 
            reply: aiReply,
            success: true
        });

    } catch (error) {
        console.error('Error in /chat:', error);
        res.status(500).json({ 
            error: "Failed to process your request",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 5. Base Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the SignNU API' });
});

// 6. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 7. 404 Handler (JSON format)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// 8. Connect to MongoDB & Start Server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🤖 Connected to DB & Server running on port ${PORT}`);
            console.log(`💬 AI Chatbot endpoint available at /chat`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
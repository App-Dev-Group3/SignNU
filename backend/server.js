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

// =====================
// Multer (in-memory upload) for PDF/file uploads
// =====================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// =====================
// Gemini AI setup for chatbot
// =====================
const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) {
  console.warn("⚠️ GEMINI_API_KEY is missing in .env");
}

const genAI = new GoogleGenerativeAI(geminiKey || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

// =====================
// Helper: safe response extraction
// =====================
const formatResponseContent = (text) => {
  if (!text) return "";
  if (typeof text === "string") return text;
  return JSON.stringify(text);
};

// 2. Logging Middleware
app.use((req, res, next) => {
    console.log(`${req.method} request to: ${req.path}`);
    next();
});

// 3. API Routes
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/forms', formRoutes);

// =====================
// Chatbot Route - POST /api/chat
// =====================
app.post("/api/chat", upload.single("pdf"), async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage && !req.file) {
      return res.status(400).json({ error: "No input provided" });
    }

    // =====================
    // Build Gemini contents
    // =====================
    const parts = [];

    if (userMessage) {
      parts.push({
        text: `
You are a helpful assistant specialized in digital signatures.
Answer strictly related to digital signature topics.

User message:
${userMessage}
        `,
      });
    }

    if (req.file) {
      parts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64"),
        },
      });
    }

    const contents = [
      {
        role: "user",
        parts,
      },
    ];

    // =====================
    // Call Gemini
    // =====================
    const result = await model.generateContent({ contents });
    const response = await result.response;

    const aiReply = formatResponseContent(response.text()) || "No reply from AI";

    return res.json({ reply: aiReply });
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    return res.status(500).json({
      error: "Failed to get AI response",
    });
  }
});

// =====================
// Summary Chat Route - POST /api/summary/chat
// =====================
app.post("/api/summary/chat", upload.single("pdf"), async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage && !req.file) {
      return res.status(400).json({ error: "No input provided" });
    }

    // =====================
    // Build Gemini contents for summary
    // =====================
    const parts = [];

    if (userMessage) {
      parts.push({
        text: `
You are a helpful assistant specialized in summarizing documents and digital signatures.
Provide a concise summary of the uploaded document or answer the user's question about it.

User message:
${userMessage}
        `,
      });
    }

    if (req.file) {
      parts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64"),
        },
      });
    }

    const contents = [
      {
        role: "user",
        parts,
      },
    ];

    // =====================
    // Call Gemini
    // =====================
    const result = await model.generateContent({ contents });
    const response = await result.response;

    const aiReply = formatResponseContent(response.text()) || "No reply from AI";

    return res.json({ reply: aiReply });
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    return res.status(500).json({
      error: "Failed to get AI response",
    });
  }
});

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
            console.log(`Connected to DB, Server and Chatbot running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
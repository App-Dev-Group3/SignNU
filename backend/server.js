require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const approvalRoutes = require('./routes/route');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const formRoutes = require('./routes/formRoutes');
const templateRoutes = require('./routes/templateRoutes');
const messageRoutes = require('./routes/messageRoutes');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = new Set(
  [FRONTEND_URL, 'http://localhost:5173', 'https://sign-nu-alpha.vercel.app']
    .filter(Boolean)
    .flatMap((origin) => origin.split(',').map((value) => value.trim()))
);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow non-browser requests (curl, same-origin)
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow any Vercel preview/deploy subdomain (e.g. *.vercel.app)
  try {
    const host = new URL(origin).host;
    if (host.endsWith('.vercel.app')) return true;
  } catch (e) {
    // ignore parse errors
  }
  return false;
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const io = require('socket.io')(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS blocked for socket origin'));
    },
    credentials: true,
  },
});

const parseCookies = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (!name) return cookies;
    cookies[name.trim()] = decodeURIComponent(rest.join('='));
    return cookies;
  }, {});

io.use((socket, next) => {
  const authHeader = socket.handshake.headers.authorization;
  const cookies = parseCookies(socket.handshake.headers.cookie || '');
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : cookies.auth_token;

  if (!token) {
    console.warn('Socket connection attempted without auth token');
    return next();
  }

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    return next();
  } catch (error) {
    console.warn('Socket auth token invalid:', error.message);
    return next();
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`);
    console.log(`User ${socket.user.id} joined room user:${socket.user.id}`);
  }

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

app.set('io', io);

// Import the promises-based version of Node.js's DNS module
const dns = require("node:dns/promises"); 

// Configures the DNS servers that Node.js will use for all subsequent DNS lookups 
// Cloudflare + Google DNS 
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// 2. ENABLE CORS (Place this before your routes!)
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
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
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      touchAfter: 24 * 3600, // lazy session update (in seconds)
    }),
    cookie: {
      httpOnly: true,
      // For cross-site deployments (frontend on different domain), set sameSite to 'none' and secure=true in production.
      // For local development we keep 'lax' and secure=false to avoid issues with http://localhost.
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
// Conversation History Storage (in-memory)
// =====================
const conversationHistory = new Map();

// Helper: Generate unique conversation ID
const generateConversationId = () => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Get or create conversation
const getConversation = (conversationId) => {
  if (!conversationHistory.has(conversationId)) {
    conversationHistory.set(conversationId, {
      messages: [],
      pdfContent: null,
      createdAt: new Date(),
    });
  }
  return conversationHistory.get(conversationId);
};

// Helper: Add message to conversation
const addMessage = (conversationId, sender, text) => {
  const conversation = getConversation(conversationId);
  conversation.messages.push({
    sender,
    text,
    timestamp: new Date(),
  });
};

// Helper: Get conversation context
const getConversationContext = (conversationId) => {
  const conversation = getConversation(conversationId);
  return conversation.messages
    .map((msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.text}`)
    .join("\n");
};

// Helper: Set PDF content in conversation
const setPdfContent = (conversationId, pdfBuffer, mimeType) => {
  const conversation = getConversation(conversationId);
  conversation.pdfContent = {
    data: pdfBuffer.toString("base64"),
    mimeType,
  };
};

// Helper: Cleanup old conversations (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, conv] of conversationHistory.entries()) {
    if (conv.createdAt.getTime() < oneHourAgo) {
      conversationHistory.delete(id);
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes

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
app.use('/api/admin', adminRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/messages', messageRoutes);

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
    let conversationId = req.body.conversationId;

    if (!userMessage && !req.file) {
      return res.status(400).json({ error: "No input provided" });
    }

    // Create new conversation if needed
    if (!conversationId) {
      conversationId = generateConversationId();
    }

    // Initialize conversation
    const conversation = getConversation(conversationId);

    // Store PDF in conversation if provided
    if (req.file) {
      setPdfContent(conversationId, req.file.buffer, req.file.mimetype);
    }

    // Build Gemini contents with history
    const parts = [];

    // Add conversation history as context
    const conversationContext = getConversationContext(conversationId);
    if (conversationContext) {
      parts.push({
        text: `Previous conversation context:\n${conversationContext}\n\n---\n`,
      });
    }

    // Add current user message
    if (userMessage) {
      parts.push({
        text: `You are a helpful assistant specialized in summarizing documents and digital signatures.
Provide a concise summary of the uploaded document or answer the user's questions about it.
Remember the context from previous messages and the document content.

Current user message:
${userMessage}`,
      });
    }

    // Add PDF if present
    if (conversation.pdfContent) {
      parts.push({
        inlineData: {
          mimeType: conversation.pdfContent.mimeType,
          data: conversation.pdfContent.data,
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

    // Store user message and AI response in conversation history
    if (userMessage) {
      addMessage(conversationId, "user", userMessage);
    }
    addMessage(conversationId, "ai", aiReply);

    return res.json({ 
      reply: aiReply,
      conversationId: conversationId,
    });
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    return res.status(500).json({
      error: "Failed to get AI response",
    });
  }
});

// =====================
// New Conversation Route - POST /api/summary/new
// =====================
app.post("/api/summary/new", (req, res) => {
  const conversationId = generateConversationId();
  getConversation(conversationId); // Initialize
  res.json({ conversationId });
});

// =====================
// Get Conversation History Route - GET /api/summary/:conversationId
// =====================
app.get("/api/summary/:conversationId", (req, res) => {
  const conversation = conversationHistory.get(req.params.conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json({
    conversationId: req.params.conversationId,
    messages: conversation.messages,
    hasPdf: !!conversation.pdfContent,
  });
});

// =====================
// Clear PDF from Conversation - POST /api/summary/:conversationId/clear-pdf
// =====================
app.post("/api/summary/:conversationId/clear-pdf", (req, res) => {
  const conversation = conversationHistory.get(req.params.conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Remove PDF from conversation
  conversation.pdfContent = null;

  res.json({ 
    success: true,
    message: "PDF removed from conversation",
    conversationId: req.params.conversationId,
  });
});

// =====================
// Update Conversation Messages - POST /api/summary/:conversationId/remove-message
// =====================
app.post("/api/summary/:conversationId/remove-message", (req, res) => {
  const conversation = conversationHistory.get(req.params.conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const { messageIndex } = req.body;
  
  if (typeof messageIndex !== "number" || messageIndex < 0 || messageIndex >= conversation.messages.length) {
    return res.status(400).json({ error: "Invalid message index" });
  }

  // Remove message from history
  conversation.messages.splice(messageIndex, 1);

  res.json({ 
    success: true,
    message: "Message removed from conversation",
    conversationId: req.params.conversationId,
    messages: conversation.messages,
  });
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
    server.listen(PORT, '0.0.0.0', () => {
            console.log(`Connected to DB, Server and Chatbot running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(' Database connection error:', error.message);
    });
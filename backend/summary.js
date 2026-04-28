require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Express app
const app = express();
const PORT = process.env.CHATBOT_PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-memory file upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Initialize Gemini AI
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.warn('⚠️ Warning: GEMINI_API_KEY not found in environment variables');
}

const genAI = new GoogleGenerativeAI(geminiKey || '');

// Routes
app.get('/', (req, res) => {
    res.json({ status: 'AI Chatbot Backend Running ✅', message: 'Use POST /chat to send messages' });
});

app.post('/chat', upload.single('pdf'), async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage && !req.file) {
            return res.status(400).json({ error: "Please provide a message or upload a PDF" });
        }

        // Get the model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        const aiReply = response.response?.text?.() || response.response?.text || "I couldn't generate a response. Please try again.";

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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 AI Chatbot Backend running at http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/chat`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});
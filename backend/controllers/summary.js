import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";

// Initialize Express app
const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory file upload
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const formatResponseContent = (content) => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content.text === 'string') return content.text;
    if (Array.isArray(content.parts)) {
        return content.parts
            .map(part => {
                if (typeof part === 'string') return part;
                if (typeof part.text === 'string') return part.text;
                return JSON.stringify(part);
            })
            .join('');
    }
    return JSON.stringify(content);
};

// POST /chat endpoint
app.get('/', (req, res) => {
    res.json({ status: 'PDF summary backend running', message: 'Use POST /chat' });
});

app.post('/chat', upload.single('pdf'), async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage && !req.file) return res.status(400).json({ error: "No input provided" });

        // Build content array for Gemini
        const contents = [];
        if (userMessage) {
            contents.push({
                text: `You are a helpful assistant specialized in digital signatures. 
                Answer the user question strictly about digital signatures. 
                User message: ${userMessage}`
            });
        }

        if (req.file) {
            contents.push({
                inlineData: {
                    mimeType: req.file.mimetype,
                    data: req.file.buffer.toString("base64")
                }
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents
        });

        // Safely get reply text
        const aiReply = formatResponseContent(response.candidates?.[0]?.content) || "No reply from AI";

        res.json({ reply: aiReply });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get AI response" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Chatbot backend running at http://localhost:${PORT}`);
});
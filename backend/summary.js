require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// =====================
// App setup
// =====================
const app = express();
const PORT = process.env.CHATBOT_PORT || 5000;

// =====================
// Middleware
// =====================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// Multer (in-memory upload)
// =====================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// =====================
// Gemini AI setup
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

// =====================
// Health check route
// =====================
app.get("/", (req, res) => {
  res.json({
    status: "PDF summary backend running ✅",
    message: "Use POST /chat to send messages",
  });
});

// =====================
// POST /chat
// =====================
app.post("/chat", upload.single("pdf"), async (req, res) => {
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
// Start server
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Chatbot backend running at http://localhost:${PORT}`);
});
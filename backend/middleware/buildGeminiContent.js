// =====================
// Gemini Content Builder Middleware
// =====================

/**
 * Build content parts for Gemini API
 * @param {string} userMessage - User's text message
 * @param {Buffer} pdfBuffer - PDF file buffer (optional)
 * @param {string} mimeType - PDF MIME type (optional)
 * @param {string} context - Previous conversation context (optional)
 * @returns {Array} Parts array for Gemini
 */
const buildGeminiParts = (userMessage, pdfBuffer, mimeType, context = "") => {
  const parts = [];

  // Add previous conversation context
  if (context) {
    parts.push({
      text: `Previous conversation context:\n${context}\n\n---\n`,
    });
  }

  // Add current user message with enhanced system prompt
  if (userMessage) {
    parts.push({
      text: `You are an intelligent chatbot assistant specialized in document summarization and digital signature management.

Core Responsibilities:
- Summarize uploaded documents clearly and concisely, highlighting key points, purpose, and critical details.
- Answer user questions using both the document content and previous conversation context.
- Interpret digital signature data, including document status, signatories, and workflow progress.

Application Feature Awareness:
- Dashboard: Provide an overview of recent activity, submissions, and pending approvals.
- New Form: Guide users in creating and submitting documents for signatures.
- Messages: Help track communication related to document reviews and approvals.
- My Submissions: Monitor submitted documents and clearly state their status (pending, approved, rejected).
- Approval Queue: Identify and prioritize documents requiring approval, including urgent or overdue items.
- Database: Retrieve and reference stored documents and past records.

Workflow Intelligence:
- Identify recent forms that need approval.
- Explain reasons for rejected documents clearly.
- Summarize pending approvals and indicate responsible parties.
- Highlight blockers, delays, or missing requirements.

Response Guidelines:
- Be concise, clear, and actionable.
- Use structured summaries when helpful.
- Focus only on relevant details.

Current user message:
${userMessage}`,
    });
  }

  // Add PDF if present
  if (pdfBuffer && mimeType) {
    parts.push({
      inlineData: {
        mimeType,
        data: pdfBuffer.toString("base64"),
      },
    });
  }

  return parts;
};

/**
 * Build Gemini content structure
 * @param {Array} parts - Message parts
 * @returns {Array} Formatted content for Gemini API
 */
const buildGeminiContent = (parts) => {
  return [
    {
      role: "user",
      parts,
    },
  ];
};

/**
 * Middleware to attach Gemini builder to request
 */
const geminiContentBuilder = (req, res, next) => {
  req.buildGeminiContent = {
    buildParts: buildGeminiParts,
    buildContent: buildGeminiContent,
  };
  next();
};

module.exports = {
  buildGeminiParts,
  buildGeminiContent,
  geminiContentBuilder,
};
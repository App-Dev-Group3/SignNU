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

  // Add current user message with system prompt
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

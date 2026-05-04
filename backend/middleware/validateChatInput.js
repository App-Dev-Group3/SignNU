// =====================
// Input Validation Middleware for Chat
// =====================

const validateChatInput = (req, res, next) => {
  const userMessage = req.body.message;
  const hasFile = !!req.file;

  if (!userMessage && !hasFile) {
    return res.status(400).json({ 
      error: "Invalid input",
      message: "Provide either a message or upload a PDF file"
    });
  }

  // Attach validated data to request
  req.chatData = {
    message: userMessage || "",
    hasFile,
  };

  next();
};

// Validate conversation ID (optional)
const validateConversationId = (req, res, next) => {
  if (req.body.conversationId && typeof req.body.conversationId !== "string") {
    return res.status(400).json({
      error: "Invalid conversation ID"
    });
  }
  next();
};

module.exports = {
  validateChatInput,
  validateConversationId,
};

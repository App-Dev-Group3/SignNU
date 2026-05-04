// =====================
// Conversation Management Middleware
// =====================

const conversationHistory = new Map();

// Generate unique conversation ID
const generateConversationId = () => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create conversation
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

// Add message to conversation
const addMessage = (conversationId, sender, text) => {
  const conversation = getConversation(conversationId);
  conversation.messages.push({
    sender,
    text,
    timestamp: new Date(),
  });
};

// Get conversation context (all previous messages)
const getConversationContext = (conversationId) => {
  const conversation = getConversation(conversationId);
  return conversation.messages
    .map((msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.text}`)
    .join("\n");
};

// Set PDF content in conversation
const setPdfContent = (conversationId, pdfBuffer, mimeType) => {
  const conversation = getConversation(conversationId);
  conversation.pdfContent = {
    data: pdfBuffer.toString("base64"),
    mimeType,
  };
};

// Get PDF content from conversation
const getPdfContent = (conversationId) => {
  const conversation = getConversation(conversationId);
  return conversation.pdfContent;
};

// Get full conversation history
const getConversationHistory = (conversationId) => {
  return conversationHistory.get(conversationId);
};

// Clear conversation
const clearConversation = (conversationId) => {
  conversationHistory.delete(conversationId);
};

// Auto-cleanup old conversations (older than 1 hour)
const startConversationCleanup = (intervalMs = 10 * 60 * 1000) => {
  setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, conv] of conversationHistory.entries()) {
      if (conv.createdAt.getTime() < oneHourAgo) {
        conversationHistory.delete(id);
        console.log(`🗑️ Deleted expired conversation: ${id}`);
      }
    }
  }, intervalMs);
};

module.exports = {
  generateConversationId,
  getConversation,
  addMessage,
  getConversationContext,
  setPdfContent,
  getPdfContent,
  getConversationHistory,
  clearConversation,
  startConversationCleanup,
};

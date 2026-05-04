// =====================
// Response Formatting Utilities
// =====================

// Safe response extraction from Gemini
const formatResponseContent = (text) => {
  if (!text) return "";
  if (typeof text === "string") return text;
  return JSON.stringify(text);
};

// Standardized success response
const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Standardized error response
const sendError = (res, error, statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: typeof error === "string" ? error : error.message,
    timestamp: new Date().toISOString(),
  });
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected error occurred";
  
  sendError(res, message, statusCode);
};

module.exports = {
  formatResponseContent,
  sendSuccess,
  sendError,
  errorHandler,
};

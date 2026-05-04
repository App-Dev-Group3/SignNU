import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Loader2, Plus } from "lucide-react";
import axios from "axios";
import { Button } from "./button";
import { Card } from "./card";

interface Message {
  sender: "user" | "ai" | "system";
  text: string;
  timestamp: Date;
  type?: "text" | "pdf";
  pdf?: File;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Hello! 👋 I'm your AI Assistant. I can help you with questions about digital signatures and forms. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation on mount
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        const res = await axios.post("http://localhost:4000/api/summary/new");
        setConversationId(res.data.conversationId);
      } catch (err) {
        console.error("Failed to initialize conversation:", err);
      }
    };
    
    if (open && !conversationId) {
      initializeConversation();
    }
  }, [open, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !pdf) return;

    // Add PDF to chat as a message if provided
    if (pdf) {
      const pdfMessage: Message = {
        sender: "user",
        text: pdf.name,
        timestamp: new Date(),
        type: "pdf",
        pdf: pdf,
      };
      setMessages((prev) => [...prev, pdfMessage]);
    }

    // Add text message if provided
    if (input.trim()) {
      const userMessage: Message = {
        sender: "user",
        text: input,
        timestamp: new Date(),
        type: "text",
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    // Prepare form data
    const formData = new FormData();
    if (input.trim()) formData.append("message", input);
    if (pdf) formData.append("pdf", pdf);
    if (conversationId) formData.append("conversationId", conversationId);

    setInput("");
    const pdfToSend = pdf;
    setPdf(null);
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:4000/api/summary/chat", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const aiMessage: Message = {
        sender: "ai",
        text: res.data.reply || "I couldn't process that request. Please try again.",
        timestamp: new Date(),
        type: "text",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        sender: "ai",
        text: "⚠️ Sorry, I encountered an error. Please try again later.",
        timestamp: new Date(),
        type: "text",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    setMessages([
      {
        sender: "ai",
        text: "Hello! 👋 I'm your AI Assistant. I can help you with questions about digital signatures and forms. What would you like to know?",
        timestamp: new Date(),
        type: "text",
      },
    ]);
    setPdf(null);
    setInput("");
    
    // Create new conversation
    try {
      const res = await axios.post("http://localhost:4000/api/summary/new");
      setConversationId(res.data.conversationId);
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    }
  };

  const handleRemovePdf = async (messageIndex: number) => {
    // Remove from frontend messages
    setMessages((prev) => prev.filter((_, i) => i !== messageIndex));
    
    // Clear PDF from backend conversation
    if (conversationId) {
      try {
        await axios.post(
          `http://localhost:4000/api/summary/${conversationId}/clear-pdf`
        );
        console.log("PDF removed from server");
      } catch (err) {
        console.error("Failed to remove PDF from server:", err);
      }
    }
  };

  const handleAddPdf = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 rounded-full w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center z-40 border-4 border-white"
      >
        {open ? <X className="w-6 h-6" /> : "🤖"}
      </button>

      {/* Chat Box */}
      {open && (
        <Card className="fixed bottom-24 right-6 w-96 h-[600px] shadow-2xl z-50 flex flex-col border-2 border-blue-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">AI Assistant</h3>
              <p className="text-sm text-blue-100">Always here to help</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="text-white hover:bg-blue-500"
              title="Start new chat"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                {msg.type === "pdf" ? (
                  // PDF Message Card
                  <div className="max-w-xs bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-lg p-3 shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 pt-1">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-400 text-white">
                          <Paperclip className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">📄 {msg.text}</p>
                        <p className="text-xs text-gray-600 mt-1">PDF Document</p>
                      </div>
                      <button
                        onClick={() => handleRemovePdf(i)}
                        className="flex-shrink-0 text-gray-500 hover:text-red-500 transition duration-150"
                        title="Remove PDF"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // Text Message
                  <div
                    className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 px-4 py-3 rounded-lg border border-gray-200 rounded-bl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg space-y-3">
            {/* PDF Preview if Selected */}
            {pdf && (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Paperclip className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{pdf.name}</span>
                </div>
                <button
                  onClick={() => setPdf(null)}
                  className="text-gray-500 hover:text-red-500 transition flex-shrink-0"
                  title="Remove from staging"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Input Controls */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPdf}
                className="px-3"
                disabled={loading}
                title={pdf ? "Select another PDF" : "Attach PDF"}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your PDF or digital signatures..."
                disabled={loading}
                className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={3}
              />
            </div>
            
            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !pdf)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? "Sending..." : "Send"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
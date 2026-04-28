import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Loader2, Plus } from "lucide-react";
import axios from "axios";
import { Button } from "./button";
import { Card } from "./card";

interface Message {
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !pdf) return;

    // Add user message
    const userMessage: Message = {
      sender: "user",
      text: input || (pdf ? `📄 ${pdf.name}` : ""),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Prepare form data
    const formData = new FormData();
    if (input) formData.append("message", input);
    if (pdf) formData.append("pdf", pdf);

    setInput("");
    setPdf(null);
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/chat", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const aiMessage: Message = {
        sender: "ai",
        text: res.data.reply || "I couldn't process that request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        sender: "ai",
        text: "⚠️ Sorry, I encountered an error. Please try again later.",
        timestamp: new Date(),
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

  const handleNewChat = () => {
    setMessages([
      {
        sender: "ai",
        text: "Hello! 👋 I'm your AI Assistant. I can help you with questions about digital signatures and forms. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
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
              <div
                key={i}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
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

          {/* File Preview */}
          {pdf && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 truncate">{pdf.name}</span>
              </div>
              <button
                onClick={() => setPdf(null)}
                className="text-gray-500 hover:text-red-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg space-y-2">
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
                onClick={() => fileInputRef.current?.click()}
                className="px-3"
                disabled={loading}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about digital signatures..."
                disabled={loading}
                className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={3}
              />
            </div>
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
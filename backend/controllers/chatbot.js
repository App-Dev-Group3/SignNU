import { useState } from 'react';
import axios from 'axios';

export default function DigitalSignatureChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input && !pdf) return;

    // Add user messages
    const newMessages = [...messages];
    if (input) newMessages.push({ sender: 'user', text: input });
    if (pdf) newMessages.push({ sender: 'user', text: `📄 PDF uploaded: ${pdf.name}` });
    setMessages(newMessages);

    // Prepare form data
    const formData = new FormData();
    if (input) formData.append('message', input);
    if (pdf) formData.append('pdf', pdf);

    try {
      setLoading(true);
      const res = await axios.post('http://localhost:4000/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Add AI response
      setMessages([
        ...newMessages,
        { sender: 'ai', text: res.data.reply },
      ]);

      // Clear inputs
      setInput('');
      setPdf(null);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { sender: 'ai', text: 'Failed to get AI response. Please try again later.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', fontFamily: 'Arial, sans-serif' }}>
      <h2>Digital Signature AI Chat</h2>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => setPdf(e.target.files[0])}
        />
      </div>

      <div style={{
        border: '1px solid #ccc',
        padding: '10px',
        height: '300px',
        overflowY: 'scroll',
        marginBottom: '10px',
        background: '#f9f9f9'
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left', margin: '5px 0' }}>
            <b>{msg.sender === 'ai' ? 'AI' : 'You'}:</b> {msg.text}
          </div>
        ))}
        {loading && <div><b>AI:</b> Typing...</div>}
      </div>

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Ask about digital signatures..."
        style={{ width: '70%', padding: '8px' }}
      />
      <button
        onClick={handleSend}
        style={{ width: '10%', padding: '5px', marginLeft: '90%', marginTop: '0px' }}
      >
        {pdf ? "Send" : "Send"}
      </button>
    </div>
  );
}
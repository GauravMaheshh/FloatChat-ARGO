// GeminiChatApp.jsx
import './GeminiChatApp.css';
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Database } from 'lucide-react';

export default function GeminiChatApp() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // Generate a session ID on the first render
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);
  
  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const serverResponse = await fetch('http://localhost:3001/api/chat-argo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          messages: newMessages // Send the whole conversation
        })
      });

      const data = await serverResponse.json();

      if (!serverResponse.ok) {
        throw new Error(data.error || `API Error: ${serverResponse.status}`);
      }

      // Persist sessionId returned by the server if present
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage = {
        role: 'model', // Correct role for the SDK
        content: data.response,
        query: data.query // Attach the query to the message
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);

    } catch (err) {
      setError(err.message || 'Failed to get response');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gemini-app">
      <div className="gemini-container">
        <div className="gemini-card">
          <div className="gemini-header">
            <div className="gemini-header-content">
              <Bot className="gemini-icon" />
              <div>
                <h1 className="gemini-title">FloatChat MCP Agent</h1>
                <p className="gemini-subtitle">Powered by Gemini 1.5 Pro</p>
              </div>
            </div>
          </div>
          
          {/* Main chat display area */}
          <div className="gemini-chat-area">
            {messages.map((msg, index) => (
              <div key={index} className={`gemini-chat-message-wrapper ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className={`gemini-chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="gemini-chat-avatar">
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <p>{msg.content}</p>
                </div>
                {/* Display the query if it exists on an assistant message */}
                {msg.role === 'model' && msg.query && (
                  <div className="gemini-query-display">
                     <div className="gemini-response-header">
                       <Database className="gemini-response-icon" />
                       <span className="gemini-response-title">Agent's SQL Query:</span>
                     </div>
                     <pre className="gemini-query-content">{msg.query}</pre>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="gemini-chat-message-wrapper assistant">
                <div className="gemini-chat-message assistant">
                  <div className="gemini-chat-avatar">
                    <Bot size={20} />
                  </div>
                  <div className="gemini-spinner"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="gemini-error">
                <AlertCircle className="gemini-error-icon" />
                <div className="gemini-error-content">
                  <p className="gemini-error-title">Error occurred:</p>
                  <p className="gemini-error-message">{error}</p>
                </div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="gemini-input-form">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e) }}
              placeholder="Ask about the Argo data..."
              rows="1"
            />
            <button type="submit" disabled={loading || !input.trim()}>
              <Send />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
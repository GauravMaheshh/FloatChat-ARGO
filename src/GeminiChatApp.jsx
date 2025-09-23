// GeminiChatApp.jsx
import './GeminiChatApp.css';
import React, { useState } from 'react';
import { Send, Bot, User, AlertCircle } from 'lucide-react';

export default function GeminiChatApp() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callGeminiAPI = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const serverResponse = await fetch('http://localhost:3001/api/chat-argo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt })
    });

      const data = await serverResponse.json();

      if (!serverResponse.ok) {
        // Use the error message from our own server
        throw new Error(data.error || `API Error: ${serverResponse.status}`);
      }

      // *** THIS IS THE KEY CHANGE ***
      // The final answer is now directly in data.response
      if (data.response) {
        setResponse(data.response);
      } else {
        throw new Error('Unexpected response format from the backend server');
      }

    } catch (err) {
      setError(err.message || 'Failed to get response');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      callGeminiAPI();
    }
  };

  // ... rest of your JSX remains exactly the same
  return (
    <div className="gemini-app">
      <div className="gemini-container">
        <div className="gemini-card">
          {/* Header */}
          <div className="gemini-header">
            <div className="gemini-header-content">
              <Bot className="gemini-icon" />
              <div>
                <h1 className="gemini-title">Gemini AI Chat</h1>
                <p className="gemini-subtitle">Powered by Gemini 1.5 Pro</p>
              </div>
            </div>
          </div>

          <div className="gemini-content">
            {/* Prompt Input */}
            <div className="gemini-input-section">
              <label className="gemini-label">
                <User className="gemini-label-icon" />
                Your Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                rows="4"
                className="gemini-textarea"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={callGeminiAPI}
              disabled={loading || !prompt.trim()}
              className={`gemini-button ${loading || !prompt.trim() ? 'gemini-button-disabled' : ''}`}
            >
              {loading ? (
                <div className="gemini-spinner"></div>
              ) : (
                <Send className="gemini-button-icon" />
              )}
              {loading ? 'Generating...' : 'Send to Gemini'}
            </button>

            {/* Error Display */}
            {error && (
              <div className="gemini-error">
                <AlertCircle className="gemini-error-icon" />
                <div className="gemini-error-content">
                  <p className="gemini-error-title">Error occurred:</p>
                  <p className="gemini-error-message">{error}</p>
                </div>
              </div>
            )}

            {/* Response Display */}
            {response && (
              <div className="gemini-response">
                <div className="gemini-response-header">
                  <Bot className="gemini-response-icon" />
                  <span className="gemini-response-title">Gemini's Response:</span>
                </div>
                <div className="gemini-response-content">
                  {response}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="gemini-footer">
          <p>Using Gemini 1.5 Flash</p>
        </div>
      </div>
    </div>
  );
}

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ArgoAgent } = require('./agent');
const { randomUUID } = require('crypto');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// In-memory session store for the hackathon
const agentSessions = {};

app.post('/api/chat-argo', async (req, res) => {
    let { sessionId, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
    }
    
    // Create a new session if one isn't provided
    if (!sessionId) {
        sessionId = randomUUID();
        agentSessions[sessionId] = new ArgoAgent(process.env.GEMINI_API_KEY);
        console.log(`New agent session created: ${sessionId}`);
    }

    let agent = agentSessions[sessionId];
    if (!agent) {
        // This handles the case where a client sends an old/invalid session ID
        agentSessions[sessionId] = new ArgoAgent(process.env.GEMINI_API_KEY);
        agent = agentSessions[sessionId];
        console.log(`Re-created agent for provided session: ${sessionId}`);
    }

    try {
        const agentResponse = await agent.run(messages);
        // Include sessionId in the response so the frontend can keep track
        res.json({ ...agentResponse, sessionId });
    } catch (error) {
        console.error(`Error in session ${sessionId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`MCP Agent API Server running on http://localhost:${PORT}`);
});
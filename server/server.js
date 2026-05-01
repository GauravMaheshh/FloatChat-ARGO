const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Pool } = require('pg');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('FloatChat-ARGO API is running. The chat endpoint is at POST /api/chat-argo');
});

// --- Database Setup ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// --- The Tool the Agent Can Use ---
const query_database = async ({ sql_query }) => {
    console.log("Executing tool: query_database with SQL:", sql_query);
    
    // VERY BASIC SECURITY: Prevent destructive queries
    const upperQuery = sql_query.toUpperCase();
    if (upperQuery.includes("DROP ") || upperQuery.includes("DELETE ") || upperQuery.includes("UPDATE ") || upperQuery.includes("INSERT ")) {
        return { error: "Permission Denied: Only SELECT queries are allowed." };
    }

    try {
        const client = await pool.connect();
        try {
            const res = await client.query(sql_query);
            return { result: res.rows };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Database query error:", err.message);
        return { error: "Failed to execute query: " + err.message };
    }
};

// --- Agent Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const tools = [
    {
        functionDeclarations: [
            {
                name: "query_database",
                description: "Executes a SQL SELECT query against the PostgreSQL database to answer user questions about the Argo oceanographic data. Always return limited rows (LIMIT 50) unless doing aggregations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        sql_query: {
                            type: "STRING",
                            description: "The raw SQL SELECT query to execute. Example: SELECT AVG(\"TEMP\") FROM argo_profiles WHERE \"PSAL\" > 35"
                        }
                    },
                    required: ["sql_query"]
                }
            }
        ]
    }
];

const systemInstruction = `You are a helpful AI assistant that answers questions about oceanographic data using a PostgreSQL database.
The database has a single table named "argo_profiles" with the following schema:
- "float_id" (VARCHAR): The ID of the Argo float
- "timestamp" (TIMESTAMP): Time of the measurement
- "latitude" (NUMERIC): Latitude
- "longitude" (NUMERIC): Longitude
- "pressure" (NUMERIC): Pressure (dbar)
- "temperature" (NUMERIC): Temperature (Celsius)
- "salinity" (NUMERIC): Salinity (PSU)

Your primary job is to formulate valid PostgreSQL SELECT queries based on the user's question, execute them using the 'query_database' tool, and use the data returned to provide a natural language response. Always wrap column names in double quotes.`;

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: tools,
    systemInstruction: systemInstruction,
});

// Map to store active chat sessions in memory
const activeChats = new Map();

// --- API Endpoint ---
app.post('/api/chat-argo', async (req, res) => {
    const { prompt, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "Missing sessionId" });
    }

    try {
        let chat;
        // Retrieve existing session or create a new one
        if (activeChats.has(sessionId)) {
            chat = activeChats.get(sessionId);
            console.log(`Resuming chat session: ${sessionId}`);
        } else {
            chat = model.startChat();
            activeChats.set(sessionId, chat);
            console.log(`Created new chat session: ${sessionId}`);
        }

        let executedToolsData = [];
        let result = await chat.sendMessage(prompt);

        // Loop to handle potential multi-turn tool calls
        while (true) {
            const response = result.response;
            const calls = response.functionCalls();

            // If there are no function calls, the agent is done, so break the loop
            if (!calls || calls.length === 0) {
                break;
            }
            
            console.log("Model requested tool calls:", calls);

            const toolResults = [];
            for (const call of calls) {
                if (call.name === "query_database") {
                    const toolResult = await query_database(call.args);
                    
                    executedToolsData.push({
                        sql: call.args.sql_query,
                        data: toolResult.result
                    });

                    const truncatedData = {
                        rowCount: toolResult.result ? toolResult.result.length : 0,
                        firstFewRows: toolResult.result ? toolResult.result.slice(0, 3) : [],
                        note: "The full dataset has been sent to the user's UI map. Do NOT list rows in your response. Just summarize."
                    };

                    toolResults.push({
                        functionName: "query_database",
                        response: { name: "query_database", content: truncatedData }
                    });
                }
            }

            // Send tool results back to the model and get the next response
            result = await chat.sendMessage(JSON.stringify(toolResults));
        }

        // The final response after all tool calls are handled
        const finalAnswer = result.response.text();
        res.json({ response: finalAnswer, toolsData: executedToolsData });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- Initial Map Data Endpoint ---
app.get('/api/initial-map', async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            const query = `
                SELECT DISTINCT ON (float_id) float_id, latitude, longitude 
                FROM argo_profiles 
                ORDER BY float_id, timestamp ASC 
                LIMIT 100
            `;
            const dbRes = await client.query(query);
            res.json({ data: dbRes.rows });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Initial map query error:", err.message);
        res.status(500).json({ error: "Failed to fetch initial map data" });
    }
});
app.get('/api/trajectory/:floatId', async (req, res) => {
    const floatId = req.params.floatId;
    try {
        const client = await pool.connect();
        try {
            const query = `
                SELECT * 
                FROM argo_profiles 
                WHERE float_id = $1 
                ORDER BY timestamp ASC 
                LIMIT 500
            `;
            const dbRes = await client.query(query, [floatId]);
            res.json({ data: dbRes.rows });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Trajectory query error:", err.message);
        res.status(500).json({ error: "Failed to fetch trajectory data" });
    }
});

app.listen(PORT, () => {
    console.log(`MCP Agent Server running on http://localhost:${PORT}`);
    console.log("Connected to PostgreSQL using environment DATABASE_URL");
});

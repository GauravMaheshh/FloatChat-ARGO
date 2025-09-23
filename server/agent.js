const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg'); // PostgreSQL client

// --- PostgreSQL Connection Pool ---
// This uses the DATABASE_URL from your .env file
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// --- New PostgreSQL Tool Definition ---
const query_database = async ({ sql_query }) => {
    console.log("Executing tool: query_database with SQL:", sql_query);
    try {
        const result = await pool.query(sql_query);
        // Return a sample of rows to keep the context for the LLM small
        const sample = result.rows.slice(0, 50);
        return { result: JSON.stringify(sample, null, 2) };
    } catch (error) {
        console.error("Database query error:", error);
        return { error: error.message };
    }
};

// --- Main Agent Class (Updated) ---
class ArgoAgent {
    constructor(apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const tools = [{
            functionDeclarations: [{
                name: "query_database",
                description: "Executes a SQL query against the Argo PostgreSQL database. Use this for any questions about temperatures, salinity, locations, or float data.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        sql_query: {
                            type: "STRING",
                            description: "A valid PostgreSQL SELECT query."
                        }
                    },
                    required: ["sql_query"]
                }
            }]
        }];

        // We provide the database schema in the system instructions
        const systemInstruction = `
You are an expert PostgreSQL data analyst. Your name is FloatChat.
You have access to a database with a table named 'argo_profiles'.
The schema for the 'argo_profiles' table is as follows:
- "PLATFORM_NUMBER" (INTEGER): The unique ID of the Argo float.
- "PROFILE_ID" (INTEGER): The ID for a specific profile from that float.
- "TIME" (TIMESTAMP): The exact date and time of the measurement.
- "LATITUDE" (REAL): The GPS latitude.
- "LONGITUDE" (REAL): The GPS longitude.
- "PRES" (REAL): The pressure in decibars, corresponding to depth.
- "TEMP" (REAL): The water temperature in Celsius.
- "PSAL" (REAL): The practical salinity.

Given a user's question, your job is to generate the correct SQL query to answer it by calling the 'query_database' tool.
Then, based on the result of that query, provide a final, human-readable answer.
`;

        this.model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            tools,
            systemInstruction
        });
    }

    async run(messages) {
        const history = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model', // Ensure correct roles
            parts: [{ text: msg.content }]
        }));

        const userPrompt = history.pop()?.parts[0]?.text;
        if (!userPrompt) return { response: "I'm sorry, I didn't receive a prompt.", query: null };

        const chat = this.model.startChat({ history });
        let result = await chat.sendMessage(userPrompt);
        let agentQuery = null;

        while (true) {
            const response = result.response;
            const calls = response.functionCalls();
            if (!calls || calls.length === 0) {
                break;
            }
            
            agentQuery = calls[0].args.sql_query; // Capture the raw SQL query
            const toolResults = [];
            for (const call of calls) {
                if (call.name === "query_database") {
                    const toolResult = await query_database(call.args);
                    toolResults.push({ functionName: "query_database", response: { name: "query_database", content: toolResult } });
                }
            }
            result = await chat.sendMessage(JSON.stringify(toolResults));
        }

        const finalAnswer = result.response.text();
        return { response: finalAnswer, query: agentQuery };
    }
}

// Export the agent. The api.js file will use this.
module.exports = { ArgoAgent };
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- Global variable to hold our entire dataset in memory ---
let argoData = [];

// --- Function to load the entire CSV into memory on startup ---
const loadArgoData = () => {
    return new Promise((resolve, reject) => {
        const results = [];
        const csvPath = path.join(__dirname, 'argo_data.csv');
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                argoData = results;
                console.log(`✅ Successfully loaded ${argoData.length} rows from argo_data.csv`);
                resolve();
            })
            .on('error', (error) => reject(error));
    });
};

// --- The Tool the Agent Can Use ---
const query_csv_data = ({ filters, aggregation }) => {
    console.log("Executing tool: query_csv_data with args:", { filters, aggregation });

    let filteredData = argoData;
    // Apply filters if they exist
    if (filters && filters.length > 0) {
        filteredData = argoData.filter(row => {
            return filters.every(condition => {
                // Basic filtering logic
                const rowValue = parseFloat(row[condition.column]);
                const conditionValue = parseFloat(condition.value);
                 switch (condition.operator) {
                    case 'equals': return row[condition.column] == condition.value;
                    case 'greater_than': return !isNaN(rowValue) && !isNaN(conditionValue) && rowValue > conditionValue;
                    case 'less_than': return !isNaN(rowValue) && !isNaN(conditionValue) && rowValue < conditionValue;
                    default: return true;
                }
            });
        });
    }

    // Apply aggregation if requested
    if (aggregation && aggregation.type && aggregation.column) {
        if (filteredData.length === 0) {
            return { result: `No data found to aggregate for column ${aggregation.column}` };
        }
        const values = filteredData.map(row => parseFloat(row[aggregation.column])).filter(v => !isNaN(v));
        let result;
        switch (aggregation.type) {
            case 'average':
                result = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            case 'sum':
                result = values.reduce((a, b) => a + b, 0);
                break;
            case 'count':
                result = values.length;
                break;
            default:
                return { result: `Unknown aggregation type: ${aggregation.type}` };
        }
        return { result: result.toFixed(2) };
    }

    // If no aggregation, return a sample of the filtered data
    return { data_sample: filteredData.slice(0, 50) };
};

// --- Agent Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const tools = [
    {
        functionDeclarations: [
            {
                name: "query_csv_data",
                description: "Queries the Argo oceanographic CSV data. Use this for any questions about temperatures, salinity, locations, or float data.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        filters: {
                            type: "ARRAY",
                            description: "An array of filter conditions to apply to the data.",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    column: { type: "STRING", description: "The CSV column to filter on." },
                                    operator: { type: "STRING", enum: ["equals", "greater_than", "less_than"] },
                                    value: { type: "STRING", description: "The value to compare against." }
                                }
                            }
                        },
                        aggregation: {
                            type: "OBJECT",
                            description: "Perform an aggregation on the filtered data. e.g., average, sum, count.",
                            properties: {
                                type: { type: "STRING", enum: ["average", "sum", "count"] },
                                column: { type: "STRING", description: "The column to aggregate." }
                            }
                        }
                    },
                    required: []
                }
            }
        ]
    }
];

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    tools: tools,
});


// --- API Endpoint ---
app.post('/api/chat-argo', async (req, res) => {
    const { prompt } = req.body;

    try {
        const chat = model.startChat();
        let result = await chat.sendMessage(prompt);

        // Loop to handle potential multi-turn tool calls
        while (true) {
            const response = result.response;
            // Correctly call the functionCalls() method to get the array
            const calls = response.functionCalls();

            // If there are no function calls, the agent is done, so break the loop
            if (!calls || calls.length === 0) {
                break;
            }
            
            console.log("Model requested tool calls:", calls);

            const toolResults = [];
            for (const call of calls) {
                if (call.name === "query_csv_data") {
                    const toolResult = query_csv_data(call.args);
                    toolResults.push({
                        functionName: "query_csv_data",
                        response: { name: "query_csv_data", content: toolResult }
                    });
                }
            }

            // Send tool results back to the model and get the next response
            result = await chat.sendMessage(JSON.stringify(toolResults));
        }

        // The final response after all tool calls are handled
        const finalAnswer = result.response.text();
        res.json({ response: finalAnswer });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- Start Server ---
app.listen(PORT, async () => {
    try {
        await loadArgoData();
        console.log(`MCP Agent Server running on http://localhost:${PORT}`);
    } catch (error) {
        console.error("Failed to load CSV data on startup:", error);
        process.exit(1);
    }
});


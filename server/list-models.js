require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // The SDK might not have listModels, so let's do a fetch directly
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.name.includes('gemini')) {
                    console.log(`- ${m.name} (generateContent: ${m.supportedGenerationMethods.includes('generateContent')})`);
                }
            });
        } else {
            console.error("Error fetching models:", data);
        }
    } catch (e) {
        console.error("Failed:", e);
    }
}
run();

# FloatChat - AI-Powered Conversational Interface for ARGO Ocean Data

[![React](https://img.shields.io/badge/React-18%2B-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-1.5_Pro-purple?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**FloatChat** is a sophisticated, AI-powered conversational agent that transforms how users interact with complex oceanographic data. This project provides a natural language interface to the vast ARGO dataset, allowing non-technical users to ask complex questions and receive precise, data-driven answers by leveraging a powerful AI agent that generates and executes SQL queries in real-time.

---

## Project Overview

Oceanographic data, particularly from the global ARGO float program, is a cornerstone of climate and marine science. However, this data is often stored in complex formats like NetCDF and requires specialized knowledge and tools to access, query, and visualize. This creates a significant barrier for researchers, students, and policymakers who need to derive insights quickly.

FloatChat bridges this gap. It replaces cumbersome data analysis tools with a simple, intuitive chat interface. Users can ask questions like *"What is the average salinity for float 2901300?"* or *"Show me the path of floats in the Arabian Sea with a temperature above 25 degrees."* The system understands the user's intent, interacts with a database, and provides a clear, concise answer, fundamentally democratizing access to vital scientific data.

---

## Solution Architecture

FloatChat is built on a modern, decoupled three-tier architecture that correctly implements the **Model Context Protocol (MCP)** pattern. The system's intelligence lies in separating the reasoning engine from the tools it uses to act on the world.



### 1. React Frontend
The user's window into the system. This is a single-page application that provides the complete chat experience. It manages the conversation history and communicates with the backend API, sending the user's prompts and displaying the agent's final response and the generated SQL query.

### 2. Node.js API Server
The central communication hub. This Express.js server acts as a session manager and a bridge between the frontend and the agent. It creates a unique session for each conversation, receives requests from the UI, and routes them to the correct agent instance.

### 3. MCP Agent
The "brain" of the operation. This is where the core AI logic resides. The agent is initialized with a powerful system prompt that gives it its persona, its knowledge of the database schema, and its primary directive: to use its `query_database` tool. It orchestrates the entire response process:
- **Reason:** It analyzes the user's question and the conversation history.
- **Act:** It generates a precise PostgreSQL query and calls its `query_database` tool.
- **Observe:** It receives the data from the database.
- **Respond:** It formulates a final, human-readable answer based on the observed data.

---

## Key Features

- **Natural Language to SQL Generation:** The agent's core capability. It dynamically writes and executes PostgreSQL queries to answer user questions, demonstrating a powerful application of LLMs in data analytics.
- **MCP-Powered Agentic Workflow:** Implements a true agentic system where the LLM is not just processing text but is a reasoning engine that uses tools (`query_database`) to interact with a real-time data source.
- **Conversational Memory:** Maintains a session-based chat history, allowing the agent to understand context and answer follow-up questions effectively.
- **Robust PostgreSQL Backend:** Utilizes a powerful, scalable PostgreSQL database to store and serve the entire ARGO dataset, ensuring fast and accurate query execution.
- **Interactive & Responsive UI:** A clean, modern chat interface built with React and `lucide-react` icons, providing an intuitive user experience.

---

## Technical Stack

| Category | Tools Used |
|---|---|
| **Frontend** | React, Vite, CSS |
| **Backend** | Node.js, Express.js |
| **AI / Agent** | Google Gemini 1.5 Pro, `@google/generative-ai` SDK |
| **Database** | PostgreSQL |
| **DevOps** | Docker |

---

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- Docker and Docker Compose
- Git

### 1. Setup
**Clone the repository and install dependencies:**
```bash
git clone [YOUR_REPOSITORY_URL]
cd floatchat

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment
In the server/ directory, create a .env file from the example:
```bash
cp server/.env.example server/.env
```
Now, edit server/.env and add your Google Gemini API Key and your PostgreSQL Database URL.

### 3. Start and Populate the Database
The easiest way to run PostgreSQL is with **Docker**.

```bash
# Start the PostgreSQL service
docker run --name argo-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=argo_db -p 5432:5432 -d postgres
```
Ensure the password and database name match your DATABASE_URL in the .env file.
Load the ARGO data into the database: This is a one-time step. This script creates the argo_profiles table and populates it from your CSV file.

```bash
node server/load-data.js
```
### 4. Run the Application

Terminal 1: Start the Backend API Server

```bash
cd server
npm run dev
```
The MCP Agent API Server should now be running on http://localhost:3001.

Terminal 2: Start the React Frontend

```bash
# From the root project directory
npm run dev
```
Your browser should open to the FloatChat application, ready to use.

## Repository Structure
```bash
floatchat-sih/
├── public/
├── server/
│   ├── .env              # Local environment variables (API keys, DB URL)
│   ├── agent.js          # The core MCP agent logic (The Brain)
│   ├── api.js            # The Express.js API server (The Web Server)
│   ├── load-data.js      # One-time script to populate PostgreSQL
│   ├── argo_data.csv     # The raw data source
│   └── package.json
├── src/
│   ├── App.jsx
│   ├── Gemini.jsx
│   └── index.css
├── .gitignore
├── package.json
└── README.md
```
By [Gaurav Mahesh](https://github.com/GauravMaheshh)

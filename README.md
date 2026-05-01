# FloatChat-ARGO: Enterprise Oceanographic Dashboard & Agent

[![React](https://img.shields.io/badge/React-18%2B-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-1.5_Flash-purple?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-lightgreen?style=for-the-badge&logo=leaflet)](https://leafletjs.com/)

**FloatChat-ARGO** is a production-grade analytical dashboard and AI-powered conversational agent. It transforms the way researchers interact with complex, high-resolution ARGO oceanographic data by combining standard interactive map visualizations with an agentic LLM capable of generating and executing complex SQL queries in real-time.

---

## Architecture & Core Achievements

### 1. Robust Data Pipeline
- **Multi-Month NetCDF Ingestion:** Python scripts recursively scan and process multiple months of raw, complex NetCDF files, extracting profiles and flattening them into a structured database format.
- **Optimized PostgreSQL Backend:** The database is designed for scale, utilizing standardized `snake_case` schema and specialized **B-Tree Indexing** on `float_id` and `timestamp` fields. This ensures lightning-fast queries even across datasets spanning millions of rows.

### 2. Generative UI & Dashboard
- **Dynamic Visualizations:** The frontend intelligently infers the type of data returned by the backend. It dynamically renders:
  - **Trajectory Maps:** Traces float paths chronologically across the globe using React Leaflet, complete with timeline scrubbing.
  - **Scatter Profiles:** Plots vertical water profiles (Temperature vs. Pressure) using Recharts.
- **Utilitarian Design:** A clean, professional dual-pane interface combining a persistent "Fleet Directory" on the left and a dedicated high-visibility data visualization canvas on the right.

### 3. Token-Optimized Hybrid AI
- **Context Management:** The agent avoids context-window exhaustion by strictly returning decoupled data payloads. The AI only receives a truncated summary of SQL queries (saving massive amounts of tokens), while the React frontend directly receives the full raw dataset for rendering.
- **Hybrid API Bypass:** To conserve strict API quotas, standard dashboard interactions (like clicking a float in the directory to see its trajectory) bypass the LLM entirely, relying on direct REST endpoints to ensure 100% uptime and zero token burn.
- **Transparent Execution:** Every AI-generated visualization includes an expandable view of the raw SQL executed against the database, ensuring absolute data transparency.

---

## Technical Stack

| Category | Technology |
|---|---|
| **Data Pipeline** | Python, `xarray`, `netCDF4`, `psycopg2` |
| **Frontend** | React, Vite, Recharts, React Leaflet (`CartoDB Dark Matter`) |
| **Backend** | Node.js, Express.js, `pg` |
| **Intelligence** | Google Gemini 2.5 Flash, `@google/generative-ai` SDK |
| **Database** | PostgreSQL |

---

## Quickstart

### Prerequisites
- Node.js (v18+)
- Python (v3.9+) & pip
- PostgreSQL Database

### 1. Environment & Database Setup
Initialize your PostgreSQL database and add your configuration and Google Gemini API key to `server/.env`.
```bash
cp server/.env.example server/.env
```

### 2. Run Data Pipeline
Place your NetCDF data into the `/data` directory, then ingest it into PostgreSQL:
```bash
python data_pipeline/ingest_argo_to_postgres.py
```

### 3. Start the Platform
FloatChat requires a dual-server development environment.

**Start the Backend (Terminal 1):**
```bash
cd server
npm install
npm run dev
```

**Start the Frontend (Terminal 2):**
```bash
# From the project root
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

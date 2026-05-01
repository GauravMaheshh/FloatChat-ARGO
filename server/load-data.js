const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function createTableAndLoadData() {
    try {
        await client.connect();
        console.log("Connected to PostgreSQL");

        // 1. Create Table
        console.log("Creating table argo_profiles...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS argo_profiles (
                id SERIAL PRIMARY KEY,
                "PRES" NUMERIC,
                "TEMP" NUMERIC,
                "PSAL" NUMERIC,
                "PLATFORM_NUMBER" VARCHAR(255),
                "PROFILE_ID" INTEGER,
                "LATITUDE" NUMERIC,
                "LONGITUDE" NUMERIC,
                "TIME" TIMESTAMP
            );
        `);
        console.log("Table argo_profiles created or already exists.");

        // Clear existing data to avoid duplicates on re-run
        await client.query('TRUNCATE TABLE argo_profiles RESTART IDENTITY;');
        console.log("Cleared existing data.");

        // 2. Read CSV and Insert
        console.log("Reading CSV and inserting data...");
        const csvPath = path.join(__dirname, 'argo_data.csv');
        let rows = [];
        let count = 0;

        await new Promise((resolve, reject) => {
            fs.createReadStream(csvPath)
                .pipe(csv())
                .on('data', (row) => {
                    // Convert types if necessary or let Postgres handle string-to-numeric
                    rows.push([
                        row.PRES || null,
                        row.TEMP || null,
                        row.PSAL || null,
                        row.PLATFORM_NUMBER || null,
                        row.PROFILE_ID || null,
                        row.LATITUDE || null,
                        row.LONGITUDE || null,
                        row.TIME || null
                    ]);
                    count++;
                })
                .on('end', async () => {
                    console.log(`Parsed ${count} rows from CSV. Starting bulk insert...`);
                    
                    // We can insert in batches to avoid overwhelming the query buffer
                    const batchSize = 1000;
                    for (let i = 0; i < rows.length; i += batchSize) {
                        const batch = rows.slice(i, i + batchSize);
                        
                        // Construct multi-value insert query
                        // e.g. INSERT INTO argo_profiles (...) VALUES ($1, $2...), ($9, $10...)
                        let queryValues = [];
                        let placeholders = [];
                        let paramIndex = 1;

                        for (const row of batch) {
                            const rowPlaceholders = [];
                            for (const val of row) {
                                queryValues.push(val);
                                rowPlaceholders.push(`$${paramIndex++}`);
                            }
                            placeholders.push(`(${rowPlaceholders.join(', ')})`);
                        }

                        const query = `
                            INSERT INTO argo_profiles ("PRES", "TEMP", "PSAL", "PLATFORM_NUMBER", "PROFILE_ID", "LATITUDE", "LONGITUDE", "TIME")
                            VALUES ${placeholders.join(', ')}
                        `;
                        
                        await client.query(query, queryValues);
                    }
                    console.log(`Successfully inserted ${count} rows into argo_profiles.`);
                    resolve();
                })
                .on('error', (err) => reject(err));
        });

    } catch (error) {
        console.error("Error setting up database:", error);
    } finally {
        await client.end();
        console.log("Database connection closed.");
    }
}

createTableAndLoadData();

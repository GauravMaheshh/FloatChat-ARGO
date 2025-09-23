// This is a one-time script to load your CSV data into PostgreSQL.
// Run it from your terminal with: node server/load-data.js

require('dotenv').config({ path: './.env' }); // Ensure it reads the .env file in the same directory
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');

if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not defined in your .env file.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const createTable = async () => {
    const query = `
        DROP TABLE IF EXISTS argo_profiles;
        CREATE TABLE argo_profiles (
            id SERIAL PRIMARY KEY,
            "PLATFORM_NUMBER" INTEGER,
            "PROFILE_ID" INTEGER,
            "TIME" TIMESTAMP,
            "LATITUDE" REAL,
            "LONGITUDE" REAL,
            "PRES" REAL,
            "TEMP" REAL,
            "PSAL" REAL
        );
    `;
    try {
        await pool.query(query);
        console.log("✅ Table 'argo_profiles' created successfully.");
    } catch (error) {
        console.error("❌ Error creating table:", error);
        throw error;
    }
};

const insertData = async () => {
    const records = [];
    const csvPath = path.join(__dirname, 'argo_data.csv');

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            records.push(row);
        })
        .on('end', async () => {
            console.log(`Read ${records.length} records from CSV. Inserting into database...`);
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const record of records) {
                    const query = `
                        INSERT INTO argo_profiles ("PLATFORM_NUMBER", "PROFILE_ID", "TIME", "LATITUDE", "LONGITUDE", "PRES", "TEMP", "PSAL")
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `;
                    const values = [
                        record.PLATFORM_NUMBER,
                        record.PROFILE_ID,
                        record.TIME,
                        record.LATITUDE,
                        record.LONGITUDE,
                        record.PRES,
                        record.TEMP,
                        record.PSAL
                    ];
                    await client.query(query, values);
                }
                await client.query('COMMIT');
                console.log('✅ All data inserted successfully.');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('❌ Error during data insertion:', error);
            } finally {
                client.release();
                pool.end();
            }
        });
};

const run = async () => {
    await createTable();
    await insertData();
};

run();
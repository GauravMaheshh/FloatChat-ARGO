import xarray as xr
import pandas as pd
from sqlalchemy import create_engine, text
import os
import glob

# --- 1. Configuration ---
# Point to the root 'data' folder which contains multiple month folders
data_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
all_files_df_list = []

# --- 2. Find and Process All Files ---
# Use recursive glob to find all .nc files in all subdirectories
nc_files = glob.glob(os.path.join(data_folder, '**', '*.nc'), recursive=True)
print(f"Found {len(nc_files)} files to process in '{data_folder}'...")

for file_path in nc_files:
    print(f"Processing: {os.path.basename(file_path)}")
    try:
        with xr.open_dataset(file_path) as ds:
            platform_number = ds['PLATFORM_NUMBER'].values[0].decode('utf-8').strip()
            num_profiles = ds.dims['N_PROF']

            for i in range(num_profiles):
                # Extract requested fields in snake_case
                profile_data = {
                    'pressure': ds['PRES'].values[i],
                    'temperature': ds['TEMP'].values[i],
                    'salinity': ds['PSAL'].values[i],
                }
                df = pd.DataFrame(profile_data)
                df['float_id'] = platform_number
                df['latitude'] = ds['LATITUDE'].values[i]
                df['longitude'] = ds['LONGITUDE'].values[i]
                df['timestamp'] = pd.to_datetime(ds['JULD'].values[i])
                all_files_df_list.append(df)
    except Exception as e:
        print(f"   -> Could not process file {os.path.basename(file_path)}. Error: {e}")

# --- 3. Final Combination and Cleaning ---
if all_files_df_list:
    final_df = pd.concat(all_files_df_list, ignore_index=True)
    final_df.dropna(subset=['pressure', 'temperature', 'salinity'], inplace=True)
    print(f"Successfully processed {len(final_df)} total data points.")

    # --- 4. Write to PostgreSQL Database ---
    try:
        # Connect using the local database URL
        db_url = 'postgresql://localhost:5432/argo_db'
        engine = create_engine(db_url)
        table_name = 'argo_profiles'
        
        # Write the final DataFrame to the SQL database.
        final_df.to_sql(table_name, engine, if_exists='replace', index=False, chunksize=5000)
        print(f"✅ Success! Data written to PostgreSQL table '{table_name}'.")

        # --- 5. Index Creation for Performance ---
        print("Creating indexes on float_id and timestamp...")
        with engine.connect() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_float_id ON argo_profiles (float_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_timestamp ON argo_profiles (timestamp);"))
            conn.commit()
        print("✅ Success! Indexes created.")

    except Exception as e:
        print(f"An error occurred during the database operation: {e}")
else:
    print("No data was processed. Please check the folder and file contents.")
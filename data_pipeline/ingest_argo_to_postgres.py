import xarray as xr
import pandas as pd
from sqlalchemy import create_engine
import os
import glob

# --- 1. Configuration ---
# Set the path to the folder containing your NetCDF files (Change to necessary folder)
data_folder = 'September_Data_netCDF'

# This list will hold the DataFrames from ALL files
all_files_df_list = []

# --- 2. Find and Process All Files ---
# Create a list of all files in the folder ending with .nc
nc_files = glob.glob(os.path.join(data_folder, '*.nc'))
print(f"Found {len(nc_files)} files to process in '{data_folder}'...")

# Loop through each file path in the list
for file_path in nc_files:
    print(f"Processing: {os.path.basename(file_path)}")
    try:
        with xr.open_dataset(file_path) as ds:
            platform_number = ds['PLATFORM_NUMBER'].values[0].decode('utf-8').strip()
            num_profiles = ds.dims['N_PROF']

            for i in range(num_profiles):
                profile_data = {
                    'PRES': ds['PRES'].values[i],
                    'TEMP': ds['TEMP'].values[i],
                    'PSAL': ds['PSAL'].values[i],
                }
                df = pd.DataFrame(profile_data)
                df['PLATFORM_NUMBER'] = platform_number
                df['PROFILE_ID'] = i
                df['LATITUDE'] = ds['LATITUDE'].values[i]
                df['LONGITUDE'] = ds['LONGITUDE'].values[i]
                df['TIME'] = pd.to_datetime(ds['JULD'].values[i])
                all_files_df_list.append(df)

    except Exception as e:
        print(f"  -> Could not process file {os.path.basename(file_path)}. Error: {e}")

# --- 3. Final Combination and Cleaning ---
if all_files_df_list:
    print("\nCombining all data into a single DataFrame...")
    final_df = pd.concat(all_files_df_list, ignore_index=True)
    final_df.dropna(subset=['PRES', 'TEMP', 'PSAL'], inplace=True)
    print(f"Successfully processed {len(final_df)} total data points.")

    # --- 4. Write to PostgreSQL Database ---
    try:
        print("Connecting to PostgreSQL...")
        db_url = 'postgresql://postgres:root@localhost:5432/argo_db'
        engine = create_engine(db_url)
        table_name = 'argo_profiles'
        
        print(f"Writing all data to table '{table_name}'...")
        final_df.to_sql(table_name, engine, if_exists='append', index=False, chunksize=1000)
        
        print(f"✅ Success! All data from the folder has been written to PostgreSQL.")

    except Exception as e:
        print(f"An error occurred during the database operation: {e}")

else:
    print("No data was processed. Please check the folder and file contents.")
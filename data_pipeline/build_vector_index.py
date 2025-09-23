import pandas as pd
from sqlalchemy import create_engine, text
import chromadb
from chromadb.utils import embedding_functions

# --- 1. Database Connections ---
print("Connecting to PostgreSQL...")
db_url = "postgresql://postgres:root@localhost:5432/argo_db"
engine = create_engine(db_url)

# --- 2. Chroma Setup ---
print("Connecting to ChromaDB...")
client = chromadb.PersistentClient(path="argo_chroma_db")

# Use Chroma’s built-in SentenceTransformer embedding wrapper
print("Loading embedding model...")
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

collection = client.get_or_create_collection(
    name="argo_profile_metadata",
    embedding_function=embed_fn
)

# --- 3. Fetch Unique Profile Metadata ---
print("Fetching unique profile metadata from PostgreSQL...")

sql_query = """
SELECT
    "PLATFORM_NUMBER",
    "PROFILE_ID",
    MIN("TIME") AS time,
    AVG("LATITUDE") AS latitude,
    AVG("LONGITUDE") AS longitude
FROM
    argo_profiles
GROUP BY
    "PLATFORM_NUMBER", "PROFILE_ID"
"""

profile_metadata_df = pd.read_sql(text(sql_query), engine)
print(f"Found {len(profile_metadata_df)} unique profiles in the database.")

# --- 4. Generate Documents + Add to Chroma ---
print("Generating documents and adding to ChromaDB...")

documents, ids, metadatas = [], [], []

for _, row in profile_metadata_df.iterrows():
    platform = row["PLATFORM_NUMBER"]
    profile_id = row["PROFILE_ID"]
    time = row["time"]
    lat = row["latitude"]
    lon = row["longitude"]

    # Ensure time is properly formatted
    time_str = pd.to_datetime(time).strftime("%Y-%m-%d") if pd.notnull(time) else "unknown date"

    # Natural language summary (embedding target)
    doc_text = (
        f"Argo float {platform} recorded profile {profile_id} on {time_str} "
        f"near latitude {lat:.2f} and longitude {lon:.2f}."
    )
    documents.append(doc_text)

    # Metadata for filtering
    metadata = {
        "platform_number": str(platform),
        "profile_id": str(profile_id),
        "date": time_str,
        "latitude": float(lat),
        "longitude": float(lon)
    }
    metadatas.append(metadata)

    ids.append(f"float_{platform}_profile_{profile_id}")

# Insert into Chroma in bulk
if documents:
    batch_size = 1000
    print(f"Adding {len(documents)} documents to ChromaDB in batches of {batch_size}...")
    
    # Loop through the lists in steps of batch_size
    for i in range(0, len(documents), batch_size):
        # Get a slice of the lists for the current batch
        batch_documents = documents[i:i + batch_size]
        batch_ids = ids[i:i + batch_size]
        batch_metadatas = metadatas[i:i + batch_size]

        # Add the batch to the collection
        collection.add(
            documents=batch_documents,
            ids=batch_ids,
            metadatas=batch_metadatas
        )
        print(f"  -> Added batch {i // batch_size + 1}")

    print(f"\n✅ Success! All metadata documents have been added to ChromaDB.")
else:
    print("⚠️ No documents were generated.")

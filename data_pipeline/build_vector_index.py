import pandas as pd
from sqlalchemy import create_engine, text
import chromadb
from chromadb.utils import embedding_functions

# --- 1. Database Connections ---
db_url = "postgresql://postgres:root@localhost:5432/argo_db"
engine = create_engine(db_url)

# --- 2. Chroma Setup ---
# This block initializes the vector database, loads the AI model that converts text
# to numerical vectors (embeddings), and prepares a 'collection' to store them.
client = chromadb.PersistentClient(path="argo_chroma_db")
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
collection = client.get_or_create_collection(
    name="argo_profile_metadata",
    embedding_function=embed_fn
)

# --- 3. Fetch Unique Profile Metadata ---
# This SQL query aggregates the data to get a single, unique entry for each
# Argo float profile, calculating its average location and earliest timestamp.
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
documents, ids, metadatas = [], [], []

# Loop through each unique profile fetched from the database.
for _, row in profile_metadata_df.iterrows():
    # Create a natural language description. This text is what the AI model will embed.
    doc_text = (
        f"Argo float {row['PLATFORM_NUMBER']} recorded profile {row['PROFILE_ID']} on "
        f"{pd.to_datetime(row['time']).strftime('%Y-%m-%d')} "
        f"near latitude {row['latitude']:.2f} and longitude {row['longitude']:.2f}."
    )
    documents.append(doc_text)

    # Create structured metadata. This is not embedded but can be used to filter search results later.
    metadata = {
        "platform_number": str(row["PLATFORM_NUMBER"]),
        "profile_id": str(row["PROFILE_ID"]),
        "date": pd.to_datetime(row['time']).strftime('%Y-%m-%d'),
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"])
    }
    metadatas.append(metadata)

    # Create a unique ID for each database entry.
    ids.append(f"float_{row['PLATFORM_NUMBER']}_profile_{row['PROFILE_ID']}")

# Add the data to ChromaDB in batches to avoid using too much memory at once.
if documents:
    batch_size = 1000
    for i in range(0, len(documents), batch_size):
        collection.add(
            documents=documents[i:i + batch_size],
            ids=ids[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size]
        )
    print(f"\n✅ Success! All metadata documents have been added to ChromaDB.")
else:
    print("⚠️ No documents were generated.")
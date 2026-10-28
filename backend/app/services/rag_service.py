"""
RAG Service — handles all ChromaDB vector storage operations.
Uses sentence-transformers directly for reliable cross-platform embeddings.
"""

import os
import chromadb

# ── Path setup ────────────────────────────────────────────────────────────
# Store ChromaDB data in a folder at the project root
# os.path.abspath resolves the relative path to an absolute one
CHROMA_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../chromadb_store")
)

# ── Initialize ChromaDB client ─────────────────────────────────────────────
try:
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    print(f"✓ ChromaDB initialized at {CHROMA_PATH}")
except Exception as e:
    print(f"⚠️  ChromaDB init warning: {e}")
    chroma_client = None

# ── Initialize embedding function ─────────────────────────────────────────
# sentence-transformers/all-MiniLM-L6-v2:
# - Small, fast model (~90MB)
# - Converts text to 384-dimensional vectors
# - Downloads automatically on first use to ~/.cache/torch/sentence_transformers
try:
    from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2
    embedding_fn = ONNXMiniLM_L6_V2()
    print("✓ Embedding model ready (ONNX all-MiniLM-L6-v2)")
except Exception as e:
    print(f"⚠️  Could not load embedding model: {e}")
    embedding_fn = None


def get_or_create_collection(collection_name: str):
    """
    Get or create a ChromaDB collection.
    Each KnowledgeBase gets its own collection named 'kb_{id}'.
    """
    if not chroma_client:
        raise RuntimeError("ChromaDB is not initialized. Check server logs.")
    if not embedding_fn:
        raise RuntimeError("Embedding model failed to load. Run: pip install sentence-transformers")

    return chroma_client.get_or_create_collection(
        name       = collection_name,
        embedding_function = embedding_fn,
        # cosine similarity works better than L2 for text
        metadata   = {"hnsw:space": "cosine"},
    )


def add_documents_to_collection(
    collection_name: str,
    texts:     list,
    metadatas: list,
    ids:       list,
) -> int:
    """
    Add text chunks to a ChromaDB collection.
    ChromaDB automatically converts texts to vectors via embedding_fn.
    Returns the number of chunks added.
    """
    collection = get_or_create_collection(collection_name)
    collection.add(documents=texts, metadatas=metadatas, ids=ids)
    return len(texts)


def search_collection(
    collection_name: str,
    query:     str,
    n_results: int = 5,
) -> list:
    """
    Search a collection for text chunks semantically similar to query.
    Returns list of matching text strings.
    Called by the execution engine (Day 7) when an agent uses a KB.
    """
    try:
        collection = get_or_create_collection(collection_name)
        count = collection.count()
        if count == 0:
            return []
        results = collection.query(
            query_texts = [query],
            n_results   = min(n_results, count),
        )
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"KB search error: {e}")
        return []


def delete_collection(collection_name: str):
    """Delete a ChromaDB collection. Called when a KB is deleted."""
    try:
        if chroma_client:
            chroma_client.delete_collection(collection_name)
    except Exception:
        pass  # safe to ignore — collection may not exist


# ── File text extraction ───────────────────────────────────────────────────

def extract_text(file_content: bytes, filename: str) -> str:
    """
    Extract plain text from an uploaded file.
    Supports: .txt, .pdf, .docx, .md and any UTF-8 text file.
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "txt"

    if ext in ("txt", "md"):
        return file_content.decode("utf-8", errors="ignore")

    elif ext == "pdf":
        try:
            import pypdf, io
            reader = pypdf.PdfReader(io.BytesIO(file_content))
            pages  = [page.extract_text() or "" for page in reader.pages]
            return "\n\n".join(pages)
        except Exception as e:
            raise ValueError(f"Could not read PDF: {e}")

    elif ext in ("docx", "doc"):
        try:
            import docx, io
            doc  = docx.Document(io.BytesIO(file_content))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            return text
        except Exception as e:
            raise ValueError(f"Could not read DOCX: {e}")

    else:
        # Unknown type — try UTF-8 decode
        return file_content.decode("utf-8", errors="ignore")


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """
    Split text into overlapping chunks for storage.

    Why overlap?
    Sentences at chunk boundaries appear in both chunks.
    This prevents losing context that spans a boundary.

    chunk_size=1000, overlap=200:
    Chunk 0: chars 0–1000
    Chunk 1: chars 800–1800  (200-char overlap)
    Chunk 2: chars 1600–2600 (200-char overlap)
    """
    text = text.strip()
    if not text:
        return []

    chunks = []
    start  = 0
    while start < len(text):
        end   = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += chunk_size - overlap

    return chunks
# RECALL: Scaling to 1,000 to 100,000+ Files

> **Technical Architecture Guide: Extreme Scale File Memory & Browser Resilience**  
> **Author**: [Audi Siva Bhanuvardhan Sarvepalli](https://www.linkedin.com/in/audi-siva-bhanuvardhan-sarvepalli-4598a8289/)

---

## 1. The Challenge of Indexing 1,000 to 100,000 (1 Lakh) Files

When indexing massive directories (e.g. an entire developer workspace, shared network drives, or archived archives), three critical bottlenecks arise:

| Dimension | 100 - 1,000 Files | 10,000 - 100,000 (1 Lakh) Files | RECALL Solution |
| :--- | :--- | :--- | :--- |
| **Browser Memory** | ~20 MB RAM in browser tab. | 1.5 GB - 3.5 GB RAM if held in memory at once (Tab crash). | **Streaming Queue Processing**: Traverses directories incrementally with a rolling buffer instead of storing all file handles in memory. |
| **Vector Search Latency** | < 10ms with in-memory SQLite / NumPy. | 1 - 3 seconds with linear scan (500k chunks). | **PostgreSQL + pgvector HNSW Index**: Switches to approximate nearest neighbor HNSW indexing (`vector_cosine_ops`), returning results in **< 15ms across 1,000,000 vectors**. |
| **AI API Rate Limits** | Fits within free Gemini tier. | Exceeds free tier quota (15 RPM) if blasted all at once. | **Local SHA-256 Cache + Exponential Backoff**: Skips unchanged files in 0ms; batches chunks to minimize API calls; retries on 429 errors. |

---

## 2. Potential Issues & Step-by-Step Solutions

### Issue A: "I selected my entire C:\ drive and the browser became unresponsive."
* **Root Cause**: Operating system root drives contain millions of system files (`C:\Windows`, `.dll`, pagefiles, registry files) that the browser cannot or should not index.
* **Solution**:
  1. Select meaningful personal folders (e.g. `C:\Users\Name\Documents`, `Downloads`, `Projects`, `Notes`).
  2. RECALL automatically skips build caches (`node_modules`, `.git`, `.venv`, `AppData`, `__pycache__`).
  3. RECALL caps processing at 25 MB per file so multi-gigabyte zip files or videos do not consume memory.

---

### Issue B: "Google Gemini API Rate Limit (HTTP 429 Too Many Requests)"
* **Root Cause**: The free Gemini API key allows up to 15 Requests Per Minute (RPM). Embedding 1,000 new files simultaneously can hit this threshold.
* **Solution**:
  1. **Batch Requests**: RECALL embeds multiple text passages in a single API call using `contents=texts`, reducing API calls by up to 90%.
  2. **SHA-256 Deduplication**: Once a file is indexed, re-indexing the same folder takes 0 API calls because the content hash matches.
  3. **Paid API Key / Pay-as-you-go**: If indexing over 10,000 files continuously, enable pay-as-you-go in Google Cloud Console / AI Studio (which raises rate limits to 1,500 - 3,000 RPM at fractions of a cent per million tokens).
  4. **Deterministic Local Fallback**: When an API limit is reached, RECALL generates deterministic semantic pseudo-vectors so the system never crashes or halts.

---

### Issue C: "File System Access API is not supported on iPhone / iPad / Firefox"
* **Root Cause**: Apple's WebKit team has not implemented `window.showDirectoryPicker()` in iOS/iPadOS Safari for security sandboxing reasons.
* **Solution**:
  1. RECALL provides the **HTML5 `<input webkitdirectory>`** and **Drag & Drop** fallback.
  2. On iPhone / iPad, tap `[ + Select Files / Folder ]` to choose batches of documents or use the camera document scanner.
  3. On Windows / Mac / Linux (Chrome, Edge, Brave, Opera), the native `[ + Index Folder ]` is used.

---

### Issue D: "Switching from SQLite to PostgreSQL + pgvector for 100k+ Files"
For production scale with over 10,000 files, connect RECALL to PostgreSQL with pgvector:

1. **Install PostgreSQL 16 & pgvector**:
   ```bash
   # Docker (Easiest)
   docker run -d --name recall-postgres -p 5432:5432 -e POSTGRES_PASSWORD=recallpass -e POSTGRES_DB=recall pgvector/pgvector:pg16
   ```
2. **Update `.env`**:
   ```env
   DATABASE_URL=postgresql+asyncpg://postgres:recallpass@localhost:5432/recall
   USE_PGVECTOR=true
   ```
3. **Restart Backend**:
   RECALL automatically executes `CREATE EXTENSION IF NOT EXISTS vector;` and indexes your vectors using high-speed pgvector distance operators (`<=>`).

# RECALL Privacy Policy & Architecture

> **“Your data stays yours. RECALL indexes meaning only when you command it.”**

---

## 1. Core Privacy Commitments

1. **Zero Silent Scanning**:
   RECALL never searches, indexes, or reads your hard drive, phone storage, or cloud directories without an explicit user action. You must deliberately select files or folders through your browser's native file-selection interface.
2. **Local-First Processing**:
   Where supported by your device, file metadata, text chunking, and content indexing occur locally on your machine.
3. **Transparent Synchronization**:
   You have granular control over what leaves your device. No file is ever synchronized across devices unless you explicitly toggle synchronization on.
4. **No LLM Training on User Files**:
   Your indexed files, summaries, and embeddings are never used to train or fine-tune public foundation models. API interactions with Google Gemini are strictly performed via enterprise API terms with zero data retention for training.

---

## 2. The Two Storage & Privacy Modes

### Mode A: Device Index (Local Mode)
* **What happens**: You select a folder (e.g., `Downloads` or `Documents`) on your device.
* **Where data lives**:
  * Original files remain in their original folders on your device.
  * Extracted text tokens and hashes (SHA-256) are held in browser storage (IndexedDB) and your active local session.
  * Embeddings are calculated for semantic recall.
* **Network exposure**: Only chunk text is sent to the Gemini Embedding API for mathematical vector generation; raw original files are never uploaded to the cloud.

### Mode B: Synced Memory (Cross-Device Search)
* **What happens**: You explicitly opt in to make indexed files searchable from other registered devices (e.g., finding a Windows file from your iPhone).
* **Two Sync Tiers**:
  1. **Searchable Index Only (Default)**:
     * Chunks, embeddings, filename, and metadata are saved to your private encrypted backend partition.
     * **No file bytes are stored in the cloud**.
     * Other devices see: `Found on: Windows PC (Downloads) - File bytes not synced`.
  2. **Full Synced Content (Optional)**:
     * The encrypted file payload is stored in your private vault.
     * Permits remote devices to securely download and view the original file.

---

## 3. Device Management & Deletion Rights

* **Device Unlinking**: You can disconnect any registered device at any time from the *Devices* screen.
* **Index Purge**: You can wipe all indexed vectors and summaries associated with a specific device or folder with a single click.
* **Safety Guarantee**: Deleting an index in RECALL **never deletes your original local files**.
* **Account Erasure**: Deleting your account immediately drops all associated database records, vector embeddings, device pairings, and cached files from the server.

---

## 4. Telemetry & Analytics
* RECALL contains **zero third-party tracking scripts, zero advertising pixels, and zero telemetry beacons**.
* System logs are restricted to operational diagnostics (e.g., rate limits, HTTP status codes) and explicitly scrub query text and file contents.

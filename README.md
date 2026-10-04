# RECALL

> **“Your devices remember files. RECALL remembers meaning.”**

RECALL is a privacy-first, cross-platform personal AI memory and semantic search system. Instead of forcing you to recall exact filenames, folder structures, or extensions, RECALL lets you query your own files using intuitive natural language.

---

## Author & Creator

* **Author**: [Audi Siva Bhanuvardhan Sarvepalli](https://www.linkedin.com/in/audi-siva-bhanuvardhan-sarvepalli-4598a8289/)
* **Repository**: [https://github.com/Sarvepalliaudi/RECALL.git](https://github.com/Sarvepalliaudi/RECALL.git)

---

## Key Capabilities

* **Natural Language File Memory**: Search across your documents, screenshots, notes, and code by meaning (e.g., *"Find the AWS architecture screenshot I saved last month"*, *"Show everything related to GATE preparation that I downloaded this week"*).
* **Cross-Platform Responsive PWA**: A unified, responsive web application and Progressive Web App running on Windows PC, Windows laptop, Mac, MacBook, Linux, Android phones/tablets, and iPhone/iPad.
* **Dual Operating Modes**:
  * **Mode A (Device Index - Local First)**: Indices and processes files explicitly selected by the user via the browser's native File System Access API or standard HTML5 directory picker. Never silently scans files.
  * **Mode B (Synced Memory - Secure Cross-Device Sync)**: Opt-in secure synchronization of searchable representations (chunks, embeddings, content hashes) or full files to search seamlessly across devices.
* **Multi-Factor Hybrid Ranking**: Combines vector cosine similarity (`text-embedding-004`), BM25 keyword matching, file-type classification, date recency, and device context to classify results into `VERY RELEVANT`, `RELEVANT`, and `POSSIBLE MATCH`.
* **Anti-Vibe-Coding Engineering**: Built strictly with utilitarian, high-density, accessible UI. Free from artificial AI visual clichés, neon glows, harsh gradients, fake terminal windows, and decorative fluff.
* **Enterprise Security Standards**: Implements HttpOnly/SameSite/Secure session handling, strict CORS, CSP, HSTS, path-traversal prevention, sanitized file storage, and OWASP-compliant practices.

---

## System Architecture

```
Client Device (PWA / Web App)
  ├── File System Access API / HTML5 Directory Selector
  ├── Client-Side IndexedDB Catalog & Cache
  └── Service Worker (Offline UI Shell & Metadata View)
          │
          │ Secure Transport (TLS / HTTPS)
          ▼
FastAPI Backend
  ├── Session Guard & Security Middleware
  ├── Document Extractors (PyMuPDF, docx, Pillow, Code Chunkers)
  ├── Embedding Pipeline (Google GenAI SDK - text-embedding-004)
  ├── Natural Language Query Intent Parser
  └── Hybrid Multi-Factor Ranking Engine
          │
          ▼
Database & Vector Storage
  ├── PostgreSQL 16 + pgvector (Production)
  └── SQLite + NumPy Vector Engine (Zero-Config Standalone Dev)
```

---

## Directory Structure

```
recall/
├── .env.example              # Environment variables template
├── .gitignore                # Comprehensive ignore rules
├── README.md                 # Project overview and setup
├── docs/                     # Production compliance documentation
│   ├── SECURITY.md           # Security architecture, controls, threat model
│   ├── PRIVACY.md            # Local-first privacy guarantees, data flows
│   └── TERMS.md              # Terms of service and usage limitations
├── backend/                  # FastAPI Application
│   ├── requirements.txt      # Python dependencies
│   ├── pyproject.toml        # Build and lint configurations
│   └── app/                  # Application modules
│       ├── main.py           # FastAPI entrypoint and lifespan
│       ├── config.py         # Pydantic v2 settings
│       ├── database/         # PostgreSQL + pgvector & SQLite fallback
│       ├── security/         # Auth, cookies, headers, rate limits
│       ├── indexer/          # Extractors, chunkers, OCR, embeddings
│       ├── search/           # Query parser, vector search, ranker
│       └── routers/          # API endpoints
├── frontend/                 # Next.js 14 Responsive PWA
│   ├── package.json          # Dependencies & scripts
│   ├── tsconfig.json         # Strict TypeScript configuration
│   ├── next.config.mjs       # Next.js & PWA configuration
│   ├── tailwind.config.ts    # Anti-vibe utilitarian design system
│   ├── public/               # Web App Manifest & Service Worker
│   └── src/                  # App Router & UI components
└── tests/                    # Automated testing suite
    ├── backend/              # Unit & integration tests
    └── frontend/             # Component & flow tests
```

---

## Getting Started

### Prerequisites
* Python 3.11+
* Node.js 18+ (tested on Node v22)
* Google Gemini API Key

### Backend Setup
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Compliance Documentation
* Detailed security controls, threat mitigations, and incident protocols are defined in [docs/SECURITY.md](docs/SECURITY.md).
* Local-first privacy boundaries, data retention, and sync opt-ins are defined in [docs/PRIVACY.md](docs/PRIVACY.md).
* Terms of service, responsible AI usage, and data ownership are outlined in [docs/TERMS.md](docs/TERMS.md).

# RECALL Security Architecture & Policy

> **Status**: Active Policy & Technical Specification  
> **Application**: RECALL (Cross-Platform Personal AI Search Engine)

---

## 1. Security Philosophy & Threat Model

RECALL handles sensitive personal files (documents, diagrams, source code, and notes). Because personal memory systems are high-value targets, RECALL is architected with a **Defense-in-Depth**, **Least-Privilege**, and **Local-First** security baseline.

### Primary Threat Vectors & Mitigations

| Threat Vector | Attack Scenario | RECALL Mitigation |
| :--- | :--- | :--- |
| **Silent Filesystem Infiltration** | Malicious script attempts to traverse user disks. | No silent scanning. Browsers cannot read files without explicit user invocation of the File System Access API or HTML5 file picker. |
| **Path Traversal (`../`)** | Uploaded filename attempts to overwrite system binaries. | Filenames are strictly sanitized; raw names are never used as storage keys. All storage files are keyed by cryptographically random UUIDv4. |
| **Arbitrary Code Execution** | Uploaded executable file (`.py`, `.exe`, `.sh`) executed on server. | Uploaded files are quarantined outside the application runtime directory. Execution permissions (`chmod -x`) are stripped. Static file servers disable script execution. |
| **Session Hijacking & XSS** | Injected JavaScript steals user authentication cookies. | Authentication tokens use `HttpOnly`, `SameSite=Lax`, and `Secure` cookies. Scripts in the browser cannot read auth tokens. Strict Content Security Policy (CSP) restricts script sources. |
| **Cross-Tenant Vector Bleed** | Query searches vectors belonging to another user. | Every database query, vector search, and chunk lookup mandates an explicit `WHERE user_id = :authenticated_user_id` clause. |
| **SQL / Vector Injection** | Crafted inputs exploit SQL or vector similarity operators. | Parameterized queries using SQLAlchemy 2.0 ORM and prepared statements. Vector dimensions and payloads are strictly validated before querying. |

---

## 2. Authentication & Session Management

1. **Password Security**:
   * Passwords hashed using `Argon2id` or `bcrypt` with high work factors and unique salts per user.
   * Minimum length enforced: 10 characters with entropy checks.
2. **Session Security**:
   * Cryptographically secure session tokens generated via `secrets.token_urlsafe(32)`.
   * Stored in encrypted server-side sessions or signed JWTs with short expiration times (72 hours max with sliding refresh).
   * Cookie flags:
     * `HttpOnly = true` (Prevents DOM-level extraction)
     * `SameSite = "Lax"` (Protects against CSRF while permitting top-level navigation)
     * `Secure = true` (Enforced on HTTPS connections)

---

## 3. Network & Transport Security

* **HTTPS Enforcement**: In production, all HTTP traffic is redirected to HTTPS with HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
* **Cross-Origin Resource Sharing (CORS)**: Strict origin allowlist configured in FastAPI. Wildcard origins (`*`) are disallowed when credentials are enabled.
* **Security Headers**:
  * `Content-Security-Policy`: Default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Permissions-Policy: geolocation=(), camera=(), microphone=()`

---

## 4. File Safety & Quarantine Controls

1. **Size Limits**:
   * Individual file upload limit: 50 MB default (configurable).
   * Batch size limits enforced to prevent server denial-of-service (ReDoS/Zip bomb protection).
2. **Magic Number Type Verification**:
   * Files are validated by magic byte signatures (header inspection) rather than relying solely on file extensions.
3. **Safe Content Extraction**:
   * PDF parsing (PyMuPDF) runs in sandboxed worker processes.
   * OCR processes (Pillow / Tesseract) run with memory caps and timeout limits.

---

## 5. Secret & Dependency Management

* **Zero Hardcoded Secrets**: All API keys (including `GEMINI_API_KEY`), database passwords, and session secrets are read strictly from runtime environment variables.
* **Dependency Auditing**: Python packages pinned in `requirements.txt`; Node dependencies locked in `package-lock.json`. Regular automated vulnerability scanning via `pip-audit` and `npm audit`.

---

## 6. Incident Reporting

If you identify a security issue, vulnerability, or unexpected behavior in RECALL:
* **Contact**: Submit reports directly to the security maintainer at `security@recall.local` (or file a private security advisory).
* Please include steps to reproduce, affected versions, and system environment.
* Responsible disclosure window: 30 days prior to public discussion.

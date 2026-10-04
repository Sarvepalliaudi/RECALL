"use client";

import React from "react";

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 font-mono text-xs">
      <div className="mb-8 border-b border-border pb-4">
        <div className="text-muted uppercase">SYSTEM INTEGRITY & OWASP COMPLIANCE</div>
        <h1 className="text-2xl font-bold text-foreground">Security Controls & Protections</h1>
        <p className="text-muted mt-1">
          Detailed cryptographic, filesystem, and transport defenses implemented in RECALL.
        </p>
      </div>

      <div className="space-y-6">
        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">1. Transport & Session Hardening</div>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li><strong className="text-foreground">Strict HTTPS & HSTS</strong>: Enforces TLS 1.3 in transit with preloaded HSTS headers.</li>
            <li><strong className="text-foreground">HttpOnly Session Cookies</strong>: Session tokens cannot be accessed or exfiltrated by client-side scripts.</li>
            <li><strong className="text-foreground">SameSite=Lax & CSRF Defense</strong>: Blocks cross-site request forgery attacks on state-changing endpoints.</li>
            <li><strong className="text-foreground">Strict Content Security Policy (CSP)</strong>: Restricts script, style, and media evaluation to trusted origins.</li>
          </ul>
        </div>

        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">2. Filesystem & Malware Protection</div>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li><strong className="text-foreground">Path Traversal Prevention</strong>: Filenames with traversal tokens (<code className="text-accent-amber">../</code>) are sanitized.</li>
            <li><strong className="text-foreground">Non-Executable Storage</strong>: Files are assigned UUID keys and stored outside executable binary directories.</li>
            <li><strong className="text-foreground">Magic Number Verification</strong>: File headers are validated against actual binary signatures.</li>
            <li><strong className="text-foreground">Strict Upload Limits</strong>: Enforces strict payload caps (50 MB) preventing memory exhaustion or ReDoS attacks.</li>
          </ul>
        </div>

        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">3. Multi-Tenant Vector Isolation</div>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li><strong className="text-foreground">Strict User ID Partitioning</strong>: Every database query and vector distance calculation is bounded by the caller’s cryptographically validated <code className="text-accent-blue">user_id</code>.</li>
            <li><strong className="text-foreground">Zero Cross-Tenant Leakage</strong>: Indices on remote devices belonging to User A can never be observed or searched by User B.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 font-mono text-xs leading-relaxed">
      <div className="mb-8 border-b border-border pb-4">
        <div className="text-muted uppercase">LEGAL SPECIFICATION</div>
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-muted mt-1">
          Last revised: October 2026.
        </p>
      </div>

      <div className="space-y-6 text-muted">
        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">1. Operating Sandbox Disclaimer</div>
          <p>
            RECALL operates strictly within the security sandboxes of web browsers and operating systems. You acknowledge that RECALL does not, and will never attempt to, bypass operating system permissions, security barriers, or device access controls.
          </p>
        </div>

        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">2. User Ownership & Authorization</div>
          <p>
            You represent and warrant that you own, hold valid licenses to, or are authorized to inspect and index all files, images, and documents processed through this application.
          </p>
        </div>

        <div className="border border-border p-5 bg-surface">
          <div className="text-foreground font-bold text-sm mb-2">3. Independent Backup Responsibility</div>
          <p>
            RECALL is a semantic discovery and retrieval tool, not a permanent data backup provider. You remain solely responsible for preserving backup copies of your local and synchronized files.
          </p>
        </div>
      </div>
    </div>
  );
}

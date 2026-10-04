"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PrivacySummary } from "@/types";

export default function PrivacyPage() {
  const [summary, setSummary] = useState<PrivacySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPrivacySummary()
      .then(setSummary)
      .catch(() => {
        // Fallback demo summary if not authenticated
        setSummary({
          user_email: "Local Guest User",
          account_created: new Date().toISOString(),
          total_devices_connected: 1,
          total_files_indexed: 0,
          total_chunks_stored: 0,
          total_files_synced: 0,
          storage_mode: "Local-First Vault",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 font-sans">
      <div className="mb-8 border-b border-border pb-4">
        <div className="text-xs font-mono text-muted uppercase">Architecture & Transparency</div>
        <h1 className="text-2xl font-mono font-bold text-foreground">Privacy Controls & Data Audit</h1>
        <p className="text-xs text-muted mt-1 font-mono">
          Strict Local-First Principle: RECALL never scans your filesystem silently.
        </p>
      </div>

      {/* Live Data Storage Audit */}
      <div className="border border-border bg-surface p-6 mb-8 font-mono text-xs">
        <div className="text-foreground font-bold mb-3 flex items-center justify-between">
          <span>ACTIVE DATA STORAGE AUDIT</span>
          <span className="text-[10px] text-accent-emerald bg-emerald-950/60 px-2 py-0.5 border border-emerald-800">
            ISOLATED USER TENANT
          </span>
        </div>

        {loading ? (
          <div className="text-muted">Loading active telemetry...</div>
        ) : summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="border border-border p-3 bg-background">
              <div className="text-muted text-[10px]">CONNECTED DEVICES</div>
              <div className="text-lg font-bold text-foreground mt-1">{summary.total_devices_connected}</div>
            </div>
            <div className="border border-border p-3 bg-background">
              <div className="text-muted text-[10px]">INDEXED FILES</div>
              <div className="text-lg font-bold text-foreground mt-1">{summary.total_files_indexed}</div>
            </div>
            <div className="border border-border p-3 bg-background">
              <div className="text-muted text-[10px]">STORED CHUNKS</div>
              <div className="text-lg font-bold text-foreground mt-1">{summary.total_chunks_stored}</div>
            </div>
            <div className="border border-border p-3 bg-background">
              <div className="text-muted text-[10px]">SYNCED PAYLOADS</div>
              <div className="text-lg font-bold text-foreground mt-1">{summary.total_files_synced}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Privacy Commitments */}
      <div className="space-y-6 text-xs text-muted font-mono leading-relaxed">
        <div className="border border-border p-5 bg-surface">
          <h2 className="text-sm font-bold text-foreground mb-2">1. The Two-Mode Privacy Model</h2>
          <p className="mb-2">
            <strong className="text-foreground">MODE A (Device Index):</strong> All file extraction and metadata indexing occur locally on this machine. Raw file bytes stay on your computer.
          </p>
          <p>
            <strong className="text-foreground">MODE B (Synced Memory):</strong> Only text summaries, embeddings, and content hashes are synchronized across your devices. No file is ever synchronized without an explicit opt-in toggle.
          </p>
        </div>

        <div className="border border-border p-5 bg-surface">
          <h2 className="text-sm font-bold text-foreground mb-2">2. Local File Safety Guarantee</h2>
          <p>
            Deleting an index, unlinking a device, or purging your memories in RECALL <strong className="text-foreground">NEVER</strong> modifies, overwrites, or deletes original files on your computer or phone.
          </p>
        </div>

        <div className="border border-border p-5 bg-surface">
          <h2 className="text-sm font-bold text-foreground mb-2">3. Zero Third-Party AI Model Training</h2>
          <p>
            Your queries and indexed documents are never transmitted to open web crawlers or utilized to train public foundation models. All vector transformations utilize isolated API calls.
          </p>
        </div>
      </div>
    </div>
  );
}

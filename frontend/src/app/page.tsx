"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { SearchResultItem, SearchResponse } from "@/types";
import { getStoredDeviceId, getStoredDeviceName, saveLocalFileRecord } from "@/lib/db";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<any>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [fsSupported, setFsSupported] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function initClient() {
      const id = await getStoredDeviceId();
      const name = await getStoredDeviceName();
      setDeviceId(id);
      setDeviceName(name);

      // Check for native File System Access API
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        setFsSupported(true);
      }

      // Auto-register device heartbeat
      api.registerDevice({
        device_id: id,
        name: name,
        platform: navigator.userAgent.toLowerCase().includes("win")
          ? "windows"
          : navigator.userAgent.toLowerCase().includes("mac")
          ? "macos"
          : navigator.userAgent.toLowerCase().includes("iphone")
          ? "ios"
          : navigator.userAgent.toLowerCase().includes("android")
          ? "android"
          : "linux",
        sync_enabled: true,
      }).catch(() => {});
    }
    initClient();

    // Keyboard shortcut: '/' to focus search input
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setSelectedResult(null);

    try {
      const resp: SearchResponse = await api.search(query.trim());
      setSearchResults(resp.results || []);
      setSearchMeta(resp.parsed_intent || null);
    } catch (err: any) {
      console.error("Search error:", err);
      // Fallback for standalone demo when backend is offline or empty
      setSearchResults([]);
      setSearchMeta(null);
    } finally {
      setSearching(false);
    }
  };

  // Chromium Native Directory Picker (File System Access API)
  const handlePickDirectoryNative = async () => {
    if (!fsSupported) return;
    try {
      setIndexing(true);
      setIndexProgress("Awaiting user permission to access selected folder...");
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      setIndexProgress(`Scanning folder: ${dirHandle.name}...`);

      let indexedCount = 0;
      // Recursively traverse directory entries
      async function scanDirectory(handle: any, path = "") {
        for await (const entry of handle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === "file") {
            const file = await entry.getFile();
            setIndexProgress(`Indexing: ${entry.name}`);
            try {
              await api.uploadFile(deviceId, file);
              indexedCount++;
              // Record locally in IndexedDB
              await saveLocalFileRecord({
                id: crypto.randomUUID(),
                filename: file.name,
                relativePath: entryPath,
                extension: file.name.substring(file.name.lastIndexOf(".")),
                sizeBytes: file.size,
                lastModified: file.lastModified,
                indexedAt: Date.now(),
                syncStatus: "index_synced",
              });
            } catch (err) {
              console.warn(`File skipped or already indexed: ${entry.name}`);
            }
          } else if (entry.kind === "directory") {
            await scanDirectory(entry, entryPath);
          }
        }
      }

      await scanDirectory(dirHandle);
      setIndexProgress(`Completed indexing ${indexedCount} files from '${dirHandle.name}'.`);
      setTimeout(() => setIndexProgress(null), 4000);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        alert(`Indexing aborted: ${err.message}`);
      }
      setIndexProgress(null);
    } finally {
      setIndexing(false);
    }
  };

  // Cross-Platform Fallback: HTML5 File / Directory input
  const handleHtml5FileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIndexing(true);
    setIndexProgress(`Preparing to index ${files.length} selected files...`);

    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setIndexProgress(`Processing (${i + 1}/${files.length}): ${file.name}`);
      try {
        await api.uploadFile(deviceId, file);
        count++;
        await saveLocalFileRecord({
          id: crypto.randomUUID(),
          filename: file.name,
          relativePath: file.webkitRelativePath || file.name,
          extension: file.name.substring(file.name.lastIndexOf(".")),
          sizeBytes: file.size,
          lastModified: file.lastModified,
          indexedAt: Date.now(),
          syncStatus: "index_synced",
        });
      } catch (err) {
        console.warn(`File upload skipped: ${file.name}`);
      }
    }

    setIndexProgress(`Successfully indexed ${count} files.`);
    setTimeout(() => setIndexProgress(null), 4000);
    setIndexing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 sm:px-6 flex-1 flex flex-col font-sans">
      {/* Top Controls & Indexing Bar */}
      <div className="border border-border bg-surface p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
        <div>
          <div className="text-muted text-[10px]">CURRENT DEVICE MEMORY</div>
          <div className="text-foreground font-bold text-sm flex items-center gap-2">
            <span>{deviceName || "Detecting..."}</span>
            <span className="text-[10px] text-accent-emerald bg-emerald-950/80 px-1.5 py-0.2 border border-emerald-800">
              ACTIVE
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {fsSupported ? (
            <button
              onClick={handlePickDirectoryNative}
              disabled={indexing}
              className="px-3 py-2 bg-foreground text-background font-bold hover:bg-muted disabled:opacity-50"
            >
              {indexing ? "Indexing..." : "[ + Index Folder ]"}
            </button>
          ) : null}

          {/* HTML5 directory/file selector fallback for iOS, Android, and non-Chromium */}
          <label className="px-3 py-2 border border-border bg-surface-raised hover:border-muted text-foreground cursor-pointer">
            <span>[ + Select Files / Folder ]</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              // @ts-ignore
              webkitdirectory=""
              onChange={handleHtml5FileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Indexing Progress Notification */}
      {indexProgress && (
        <div className="border border-border bg-background p-3 mb-6 font-mono text-xs text-muted flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="animate-pulse text-accent-blue font-bold">●</span>
            <span>{indexProgress}</span>
          </span>
          {indexing && <span className="text-[10px] text-muted">LOCAL EXTRACTION ACTIVE</span>}
        </div>
      )}

      {/* Main Search Input: "What are you looking for?" */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='What are you looking for? (e.g., "Find the AWS architecture screenshot I saved last month")'
            className="w-full bg-surface border border-border focus:border-border-focus px-4 py-3.5 text-sm sm:text-base text-foreground placeholder:text-muted focus:outline-none font-sans"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-3.5 py-1.5 bg-foreground text-background font-mono text-xs font-bold hover:bg-muted disabled:opacity-40"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Quick Example Queries */}
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-mono text-muted items-center">
          <span className="text-[10px] uppercase text-muted-dark">Try meaning:</span>
          {[
            "AWS architecture screenshot from last month",
            "PDF containing disaster recovery team diagram",
            "GATE preparation files downloaded this week",
          ].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setQuery(sample);
                setTimeout(() => handleSearch(), 50);
              }}
              className="px-2 py-0.5 border border-border bg-background hover:border-muted text-left text-[11px] truncate max-w-xs"
            >
              “{sample}”
            </button>
          ))}
        </div>
      </form>

      {/* Query Understanding Diagnostics (Honest, Functional) */}
      {searchMeta && (
        <div className="border border-border bg-surface p-3 mb-6 font-mono text-xs text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-foreground font-semibold">Parsed Meaning:</span>
          <span>Topic: <strong className="text-foreground">{searchMeta.semantic_topic}</strong></span>
          {searchMeta.detected_types?.length > 0 && (
            <span>Types: <strong className="text-accent-blue">{searchMeta.detected_types.join(", ")}</strong></span>
          )}
          {searchMeta.detected_device && (
            <span>Target: <strong className="text-accent-emerald">{searchMeta.detected_device}</strong></span>
          )}
          {searchMeta.time_filter_active && (
            <span className="text-accent-amber font-semibold">[Time Horizon Filter Applied]</span>
          )}
        </div>
      )}

      {/* Search Results List */}
      <div className="flex-1 flex flex-col">
        {searching ? (
          <div className="border border-border bg-surface p-12 text-center text-muted font-mono text-xs">
            Querying local & synchronized semantic memory indices...
          </div>
        ) : hasSearched && searchResults.length === 0 ? (
          <div className="border border-border bg-surface p-10 text-center font-mono text-xs text-muted space-y-2">
            <div className="text-foreground font-bold text-sm">No Matching Files Found</div>
            <p className="max-w-md mx-auto">
              RECALL could not find documents or media matching the semantic meaning of your query. Try indexing additional folders or rephrasing your search.
            </p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-3">
            <div className="font-mono text-xs text-muted flex items-center justify-between pb-1">
              <span>{searchResults.length} {searchResults.length === 1 ? "result" : "results"} ranked by semantic relevance</span>
              <span>Sorted by composite match</span>
            </div>

            {searchResults.map((item) => {
              // Categorize relevance badge color without harsh neon
              const badgeClass =
                item.relevance === "VERY RELEVANT"
                  ? "text-accent-emerald bg-emerald-950/80 border-emerald-800"
                  : item.relevance === "RELEVANT"
                  ? "text-accent-blue bg-blue-950/80 border-blue-800"
                  : "text-muted bg-surface-raised border-border";

              return (
                <div
                  key={item.file_id}
                  className="border border-border bg-surface p-4 hover:border-muted transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 font-mono text-xs"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground font-sans">{item.filename}</span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-border uppercase text-muted bg-background">
                        {item.extension.replace(".", "") || "FILE"}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${badgeClass}`}>
                        {item.relevance}
                      </span>
                    </div>

                    {/* Metadata & Origin Device */}
                    <div className="text-muted text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                      <span>Source Device: <strong className="text-foreground">{item.device_name}</strong> ({item.device_platform})</span>
                      <span>Path: <code className="text-foreground">{item.relative_path}</code></span>
                      {item.file_modified_at && (
                        <span>Date: {new Date(item.file_modified_at).toLocaleDateString()}</span>
                      )}
                      <span>
                        Status:{" "}
                        <strong className={item.sync_status === "full_synced" ? "text-accent-emerald" : "text-muted"}>
                          {item.sync_status === "full_synced" ? "Synced" : "Indexed on Host"}
                        </strong>
                      </span>
                    </div>

                    {/* Why It Matches Explanation */}
                    <div className="border-l-2 border-border pl-2.5 py-0.5 text-muted font-sans text-xs">
                      <strong className="text-foreground font-mono text-[11px]">Why: </strong>
                      {item.reason}
                    </div>

                    {/* Matched Content Snippet */}
                    {item.matched_snippet && (
                      <div className="bg-background border border-border p-2 text-muted text-[11px] font-mono leading-relaxed overflow-hidden">
                        {item.matched_snippet}
                      </div>
                    )}
                  </div>

                  {/* Result Action Button */}
                  <div className="sm:self-center shrink-0">
                    <button
                      onClick={() => setSelectedResult(item)}
                      className="w-full sm:w-auto px-3.5 py-2 border border-border bg-surface-raised hover:border-muted text-foreground font-mono text-xs"
                    >
                      [ {item.action_label} ]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !hasSearched ? (
          <div className="border border-border bg-surface p-12 text-center font-mono text-xs text-muted space-y-4">
            <div className="text-foreground font-bold text-base">“Your devices remember files. RECALL remembers meaning.”</div>
            <p className="max-w-lg mx-auto font-sans leading-relaxed">
              Query your personal documents, notes, diagrams, and code using natural language. To get started, click <strong className="text-foreground font-mono">[ + Index Folder ]</strong> above to grant browser access to a local folder, or search files already synchronized across your devices.
            </p>
          </div>
        ) : null}
      </div>

      {/* Information / Inspection Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="border border-border bg-surface max-w-xl w-full p-6 font-mono text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-foreground font-bold text-sm">FILE INFORMATION</span>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-muted hover:text-foreground text-sm font-bold"
              >
                [ Close ]
              </button>
            </div>

            <div className="space-y-2 text-muted">
              <div><strong className="text-foreground">Filename:</strong> {selectedResult.filename}</div>
              <div><strong className="text-foreground">Source Device:</strong> {selectedResult.device_name} ({selectedResult.device_platform})</div>
              <div><strong className="text-foreground">Location:</strong> {selectedResult.relative_path}</div>
              <div><strong className="text-foreground">File Size:</strong> {(selectedResult.size_bytes / 1024).toFixed(1)} KB</div>
              <div><strong className="text-foreground">Relevance Tier:</strong> {selectedResult.relevance}</div>
              <div><strong className="text-foreground">Match Rationale:</strong> {selectedResult.reason}</div>
              <div><strong className="text-foreground">Sync Status:</strong> {selectedResult.sync_status}</div>
            </div>

            {selectedResult.sync_status !== "full_synced" ? (
              <div className="border border-border bg-background p-3 text-muted leading-relaxed font-sans">
                <strong className="text-foreground font-mono">CROSS-DEVICE ACCESS NOTICE:</strong>
                <p className="mt-1">
                  This file was indexed on <strong>{selectedResult.device_name}</strong>. Only its searchable semantic representation was synchronized. To directly download or open the original bytes from this device, enable Full Secure Sync on {selectedResult.device_name}.
                </p>
              </div>
            ) : (
              <div className="border border-accent-emerald/40 bg-emerald-950/40 p-3 text-accent-emerald">
                This file is securely synchronized. Content is available for download and inspection.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 bg-foreground text-background font-bold hover:bg-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

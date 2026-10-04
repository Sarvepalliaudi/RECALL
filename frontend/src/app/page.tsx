"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { SearchResultItem, SearchResponse } from "@/types";
import { getStoredDeviceId, getStoredDeviceName, saveLocalFileRecord } from "@/lib/db";

const SUPPORTED_EXTS = new Set([
  ".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".bmp",
  ".py", ".java", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".csv",
  ".json", ".sql", ".sh", ".yaml", ".yml"
]);

const IGNORED_FOLDERS = new Set([
  "node_modules", ".git", ".next", ".venv", "venv", "__pycache__", "dist",
  "build", ".vscode", ".idea", "AppData", "System Volume Information", "$RECYCLE.BIN"
]);

const PARALLEL_WORKERS = 4;

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState<string | null>(null);
  const [indexProgressPct, setIndexProgressPct] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [fsSupported, setFsSupported] = useState(false);
  
  const [indexedFiles, setIndexedFiles] = useState<any[]>([]);
  const [showIndexedList, setShowIndexedList] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelIndexRef = useRef(false);
  const indexedFilesRef = useRef<any[]>([]);

  useEffect(() => {
    indexedFilesRef.current = indexedFiles;
  }, [indexedFiles]);

  // Load device info & existing indexed files
  useEffect(() => {
    async function initClient() {
      const id = await getStoredDeviceId();
      const name = await getStoredDeviceName();
      setDeviceId(id);
      setDeviceName(name);

      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        setFsSupported(true);
      }

      // Auto-register device
      try {
        await api.registerDevice({
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
        });
      } catch (e) {
        console.warn("Auto-register notice:", e);
      }

      refreshFilesList();
    }
    initClient();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const refreshFilesList = async () => {
    setLoadingFiles(true);
    try {
      const files = await api.listIndexedFiles();
      setIndexedFiles(files || []);
      indexedFilesRef.current = files || [];
    } catch (err) {
      console.warn("Could not list indexed files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setSelectedResult(null);

    try {
      const resp: SearchResponse = await api.search(query.trim());
      setSearchResults(resp.results || []);
      setSearchMeta(resp.parsed_intent || null);
    } catch (err: any) {
      console.error("Search error:", err);
      setSearchError(err.message || "Failed to execute search query.");
      setSearchResults([]);
      setSearchMeta(null);
    } finally {
      setSearching(false);
    }
  };

  // High-performance parallel upload pipeline
  const processFilesInParallel = async (
    items: { file: File; path: string }[],
    concurrency = PARALLEL_WORKERS
  ) => {
    if (items.length === 0) return { completed: 0, skipped: 0, errors: 0 };

    let completed = 0;
    let skipped = 0;
    let errors = 0;
    let queueIdx = 0;

    async function worker() {
      while (queueIdx < items.length && !cancelIndexRef.current) {
        const idx = queueIdx++;
        const item = items[idx];

        // 1. Instant Client-Side Duplicate Skip (0ms)
        const alreadyIndexed = indexedFilesRef.current.some(
          (f) => f.filename === item.file.name && f.size_bytes === item.file.size
        );
        if (alreadyIndexed) {
          skipped++;
          completed++;
          setIndexProgressPct(Math.round((completed / items.length) * 100));
          continue;
        }

        setIndexStatus(
          `[${completed + 1}/${items.length}] Processing: ${item.file.name} (${Math.min(concurrency, items.length)} parallel pipelines)`
        );

        try {
          await api.uploadFile(deviceId, item.file);
          completed++;
          await saveLocalFileRecord({
            id: crypto.randomUUID(),
            filename: item.file.name,
            relativePath: item.path,
            extension: item.file.name.substring(item.file.name.lastIndexOf(".")),
            sizeBytes: item.file.size,
            lastModified: item.file.lastModified,
            indexedAt: Date.now(),
            syncStatus: "index_synced",
          });
        } catch (err: any) {
          console.error(`Error uploading ${item.file.name}:`, err);
          errors++;
        }

        setIndexProgressPct(Math.round((completed / items.length) * 100));
      }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return { completed, skipped, errors };
  };

  // Chromium Native Directory Picker (File System Access API)
  const handlePickDirectoryNative = async () => {
    if (!fsSupported) return;
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      setIndexing(true);
      cancelIndexRef.current = false;
      setIndexStatus(`Scanning '${dirHandle.name}' for supported files...`);
      setIndexProgressPct(0);

      const filesToProcess: { file: File; path: string }[] = [];

      async function scanDirectory(handle: any, currentPath = "") {
        if (cancelIndexRef.current) return;
        for await (const entry of handle.values()) {
          if (cancelIndexRef.current) break;
          const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          
          if (entry.kind === "file") {
            const ext = entry.name.substring(entry.name.lastIndexOf(".")).toLowerCase();
            if (SUPPORTED_EXTS.has(ext)) {
              try {
                const file = await entry.getFile();
                if (file.size <= 25 * 1024 * 1024) {
                  filesToProcess.push({ file, path: entryPath });
                }
              } catch (e) {
                // Permission or read error
              }
            }
          } else if (entry.kind === "directory") {
            if (!IGNORED_FOLDERS.has(entry.name)) {
              await scanDirectory(entry, entryPath);
            }
          }
        }
      }

      await scanDirectory(dirHandle);

      if (filesToProcess.length === 0) {
        setIndexStatus(`No supported documents found in '${dirHandle.name}'. (Supported: PDF, DOCX, TXT, MD, Images, Code, CSV)`);
        setIndexProgressPct(null);
        setIndexing(false);
        return;
      }

      setIndexStatus(`Discovered ${filesToProcess.length} supported files. Launching parallel indexing...`);

      const { completed, skipped, errors } = await processFilesInParallel(filesToProcess);

      if (!cancelIndexRef.current) {
        setIndexStatus(
          `Indexing finished! ${completed - skipped} new files indexed, ${skipped} unchanged files skipped (${errors} errors).`
        );
        setIndexProgressPct(100);
        setTimeout(() => {
          setIndexStatus(null);
          setIndexProgressPct(null);
        }, 5000);
      }

      await refreshFilesList();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        alert(`Folder selection error: ${err.message}`);
      }
      setIndexStatus(null);
      setIndexProgressPct(null);
    } finally {
      setIndexing(false);
    }
  };

  // HTML5 Directory & File Input
  const handleHtml5FileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    setIndexing(true);
    cancelIndexRef.current = false;
    setIndexProgressPct(0);

    const validFiles: { file: File; path: string }[] = [];
    for (let i = 0; i < rawFiles.length; i++) {
      const f = rawFiles[i];
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      if (SUPPORTED_EXTS.has(ext) && f.size <= 25 * 1024 * 1024) {
        validFiles.push({ file: f, path: f.webkitRelativePath || f.name });
      }
    }

    if (validFiles.length === 0) {
      setIndexStatus("Selected files are unsupported or exceed 25MB. (Supported: PDF, DOCX, TXT, MD, Images, Code, CSV)");
      setIndexing(false);
      setIndexProgressPct(null);
      return;
    }

    setIndexStatus(`Discovered ${validFiles.length} supported files. Processing in parallel...`);

    const { completed, skipped, errors } = await processFilesInParallel(validFiles);

    setIndexStatus(
      `Indexing complete! ${completed - skipped} new files added, ${skipped} unchanged skipped (${errors} errors).`
    );
    setIndexProgressPct(100);
    setTimeout(() => {
      setIndexStatus(null);
      setIndexProgressPct(null);
    }, 5000);

    setIndexing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refreshFilesList();
  };

  // Drag and Drop Handling (Folders & Files)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setIndexing(true);
    cancelIndexRef.current = false;
    setIndexStatus("Reading dropped files and directories...");
    setIndexProgressPct(0);

    const droppedFiles: { file: File; path: string }[] = [];

    // Helper to traverse file system entries from DataTransfer
    async function traverseEntry(entry: any, currentPath = "") {
      if (!entry) return;
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve));
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (SUPPORTED_EXTS.has(ext) && file.size <= 25 * 1024 * 1024) {
          droppedFiles.push({ file, path: currentPath ? `${currentPath}/${file.name}` : file.name });
        }
      } else if (entry.isDirectory) {
        if (!IGNORED_FOLDERS.has(entry.name)) {
          const reader = entry.createReader();
          const entries: any[] = await new Promise((resolve) => reader.readEntries(resolve));
          for (const sub of entries) {
            await traverseEntry(sub, currentPath ? `${currentPath}/${entry.name}` : entry.name);
          }
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) {
        await traverseEntry(entry);
      } else {
        const f = items[i].getAsFile();
        if (f) {
          const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
          if (SUPPORTED_EXTS.has(ext) && f.size <= 25 * 1024 * 1024) {
            droppedFiles.push({ file: f, path: f.name });
          }
        }
      }
    }

    if (droppedFiles.length === 0) {
      setIndexStatus("No supported documents found in dropped items.");
      setIndexing(false);
      setIndexProgressPct(null);
      return;
    }

    setIndexStatus(`Discovered ${droppedFiles.length} files. Starting parallel index...`);
    const { completed, skipped, errors } = await processFilesInParallel(droppedFiles);

    setIndexStatus(
      `Drop indexing complete! ${completed - skipped} new files added, ${skipped} unchanged skipped.`
    );
    setIndexProgressPct(100);
    setTimeout(() => {
      setIndexStatus(null);
      setIndexProgressPct(null);
    }, 5000);

    setIndexing(false);
    await refreshFilesList();
  };

  const handleCancelIndexing = () => {
    cancelIndexRef.current = true;
    setIndexStatus("Halting indexing worker pool...");
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!confirm(`Remove '${filename}' from RECALL memory index?\n\n(Original file on your computer will NOT be deleted)`)) {
      return;
    }
    try {
      await api.deleteIndexedFile(fileId);
      await refreshFilesList();
      if (searchResults.some((r) => r.file_id === fileId)) {
        setSearchResults(searchResults.filter((r) => r.file_id !== fileId));
      }
    } catch (err: any) {
      alert(`Could not delete index: ${err.message}`);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-5xl mx-auto w-full px-4 py-6 sm:px-6 flex-1 flex flex-col font-sans transition-colors ${
        isDragging ? "bg-surface-raised border-2 border-dashed border-accent-blue" : ""
      }`}
    >
      {/* Top Device & Memory Summary Bar */}
      <div className="border border-border bg-surface p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
        <div>
          <div className="text-muted text-[10px]">CURRENT DEVICE MEMORY</div>
          <div className="text-foreground font-bold text-sm flex items-center gap-2">
            <span>{deviceName || "Workstation"}</span>
            <span className="text-[10px] text-accent-emerald bg-emerald-950/80 px-1.5 py-0.2 border border-emerald-800">
              ACTIVE
            </span>
            <span className="text-muted text-xs border-l border-border pl-2">
              Files in Memory: <strong className="text-foreground">{indexedFiles.length}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {fsSupported && (
            <button
              onClick={handlePickDirectoryNative}
              disabled={indexing}
              className="px-3.5 py-2 bg-foreground text-background font-bold hover:bg-muted disabled:opacity-50 text-xs font-mono"
            >
              {indexing ? "Indexing..." : "[ + Index Folder ]"}
            </button>
          )}

          <label className="px-3.5 py-2 border border-border bg-surface-raised hover:border-muted text-foreground cursor-pointer text-xs font-mono">
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

          <button
            onClick={() => setShowIndexedList(!showIndexedList)}
            className="px-3 py-2 border border-border bg-surface-raised hover:border-muted text-muted hover:text-foreground text-xs font-mono"
          >
            {showIndexedList ? "[ Hide Files List ]" : `[ View Memory Files (${indexedFiles.length}) ]`}
          </button>
        </div>
      </div>

      {/* Drag & Drop Feedback Banner */}
      {isDragging && (
        <div className="border border-accent-blue bg-blue-950/50 p-6 mb-4 text-center font-mono text-sm text-foreground animate-pulse">
          Drop folders or files here to immediately index into RECALL memory...
        </div>
      )}

      {/* Indexing Progress & Feedback Bar */}
      {indexStatus && (
        <div className="border border-border bg-surface-raised p-3.5 mb-4 font-mono text-xs text-muted flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-foreground font-semibold">
              <span className="animate-pulse text-accent-blue font-bold">●</span>
              <span>{indexStatus}</span>
            </span>
            {indexing && (
              <button
                onClick={handleCancelIndexing}
                className="px-2 py-0.5 border border-accent-rose text-accent-rose hover:bg-rose-950 text-[10px]"
              >
                [ Stop ]
              </button>
            )}
          </div>
          {indexProgressPct !== null && (
            <div className="w-full bg-background border border-border h-2 rounded-sm overflow-hidden">
              <div
                className="bg-accent-blue h-full transition-all duration-200"
                style={{ width: `${indexProgressPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Collapsible View of All Indexed Files in Memory */}
      {showIndexedList && (
        <div className="border border-border bg-surface p-4 mb-6 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-foreground font-bold">FILES CURRENTLY IN RECALL MEMORY ({indexedFiles.length})</span>
            <button
              onClick={refreshFilesList}
              className="text-muted hover:text-foreground text-[11px]"
            >
              [ Refresh ]
            </button>
          </div>

          {loadingFiles ? (
            <div className="text-muted py-4 text-center">Loading files list...</div>
          ) : indexedFiles.length === 0 ? (
            <div className="text-muted py-4 text-center">
              No files indexed into memory yet. Click <strong className="text-foreground">[ + Index Folder ]</strong> or <strong className="text-foreground">[ + Select Files ]</strong> above to add files.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-border/50">
              {indexedFiles.map((file) => (
                <div key={file.id} className="pt-2 pb-1 flex items-center justify-between gap-4">
                  <div className="truncate">
                    <span className="text-foreground font-bold font-sans">{file.filename}</span>
                    <span className="text-muted text-[11px] ml-2">({file.extension.toUpperCase()}, {(file.size_bytes / 1024).toFixed(1)} KB)</span>
                    <div className="text-muted-dark text-[10px] truncate">{file.relative_path}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id, file.filename)}
                    className="text-accent-rose hover:underline text-[10px] shrink-0"
                  >
                    [ Remove ]
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Search Input Form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='What are you looking for? (e.g., "Find the AWS architecture diagram from last month")'
            className="w-full bg-surface border border-border focus:border-border-focus px-4 py-3.5 text-sm sm:text-base text-foreground placeholder:text-muted focus:outline-none font-sans"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-4 py-2 bg-foreground text-background font-mono text-xs font-bold hover:bg-muted disabled:opacity-40"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Quick Example Meaning Queries */}
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
                setTimeout(() => {
                  searchInputRef.current?.form?.requestSubmit();
                }, 50);
              }}
              className="px-2 py-0.5 border border-border bg-background hover:border-muted text-left text-[11px] truncate max-w-xs"
            >
              “{sample}”
            </button>
          ))}
        </div>
      </form>

      {/* Error Banner */}
      {searchError && (
        <div className="border border-accent-amber/40 bg-amber-950/40 text-accent-amber p-3.5 mb-4 font-mono text-xs flex items-center justify-between">
          <span>Search Error: {searchError}</span>
          <button onClick={() => setSearchError(null)} className="text-muted hover:text-foreground">
            [x]
          </button>
        </div>
      )}

      {/* Query Understanding Diagnostics */}
      {searchMeta && (
        <div className="border border-border bg-surface p-3 mb-4 font-mono text-xs text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-foreground font-semibold">Understood Meaning:</span>
          <span>Topic: <strong className="text-foreground">“{searchMeta.semantic_topic}”</strong></span>
          {searchMeta.detected_types?.length > 0 && (
            <span>Target Types: <strong className="text-accent-blue">{searchMeta.detected_types.join(", ")}</strong></span>
          )}
          {searchMeta.detected_device && (
            <span>Target Device: <strong className="text-accent-emerald">{searchMeta.detected_device}</strong></span>
          )}
          {searchMeta.time_filter_active && (
            <span className="text-accent-amber font-semibold">[Time Horizon Filter Applied]</span>
          )}
        </div>
      )}

      {/* Zero Files Warning Notice */}
      {indexedFiles.length === 0 && !indexing && (
        <div className="border border-border bg-surface p-4 mb-4 text-xs font-mono text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            <strong className="text-foreground">No files in memory yet.</strong> RECALL searches meaning across files you select.
          </span>
          <span className="text-accent-blue">Click [+ Index Folder] or drop files here to start.</span>
        </div>
      )}

      {/* Search Results Area */}
      <div className="flex-1 flex flex-col">
        {searching ? (
          <div className="border border-border bg-surface p-12 text-center text-muted font-mono text-xs">
            Querying local & synchronized semantic vector indices...
          </div>
        ) : hasSearched && searchResults.length === 0 ? (
          <div className="border border-border bg-surface p-10 text-center font-mono text-xs text-muted space-y-2">
            <div className="text-foreground font-bold text-sm">No Matching Files Found</div>
            <p className="max-w-md mx-auto text-muted">
              {indexedFiles.length === 0
                ? "You have 0 files indexed in memory. Please use [+ Index Folder] or [+ Select Files] to add documents before searching."
                : `No indexed document passages closely matched "${query}". Try searching for related keywords, topics, or index additional folders.`}
            </p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-3">
            <div className="font-mono text-xs text-muted flex items-center justify-between pb-1">
              <span>{searchResults.length} {searchResults.length === 1 ? "result" : "results"} ranked by semantic relevance</span>
              <span>Sorted by composite match score</span>
            </div>

            {searchResults.map((item) => {
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
                  <div className="flex-1 space-y-2.5">
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
                      <span>Source Device: <strong className="text-foreground">{item.device_name}</strong></span>
                      <span>Location: <code className="text-foreground">{item.relative_path}</code></span>
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
                    <div className="border-l-2 border-accent-blue pl-2.5 py-0.5 text-muted font-sans text-xs">
                      <strong className="text-foreground font-mono text-[11px]">Why it matches: </strong>
                      {item.reason}
                    </div>

                    {/* Matched Content Snippet */}
                    {item.matched_snippet && (
                      <div className="bg-background border border-border p-2.5 text-muted text-[11px] font-mono leading-relaxed overflow-hidden">
                        <div className="text-[10px] uppercase text-muted-dark mb-1">Matched Content Passage:</div>
                        <div className="text-foreground/90 whitespace-pre-wrap">{item.matched_snippet}</div>
                      </div>
                    )}
                  </div>

                  {/* Result Action Button */}
                  <div className="sm:self-center shrink-0">
                    <button
                      onClick={() => setSelectedResult(item)}
                      className="w-full sm:w-auto px-3.5 py-2 border border-border bg-surface-raised hover:border-muted text-foreground font-mono text-xs font-semibold"
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
              Query your personal documents, notes, diagrams, and code using natural language. To get started, click <strong className="text-foreground font-mono">[ + Index Folder ]</strong> above, or drag and drop files and folders right onto this page.
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

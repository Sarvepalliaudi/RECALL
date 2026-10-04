"use client";

import React, { useState, useEffect } from "react";

export default function InstallPage() {
  const [platform, setPlatform] = useState<string>("Detecting platform...");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect OS platform
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) setPlatform("Windows PC / Laptop");
    else if (ua.includes("mac")) setPlatform("macOS (MacBook / iMac)");
    else if (ua.includes("iphone")) setPlatform("Apple iOS (iPhone)");
    else if (ua.includes("ipad")) setPlatform("Apple iPadOS (iPad)");
    else if (ua.includes("android")) setPlatform("Android Phone / Tablet");
    else if (ua.includes("linux")) setPlatform("Linux Desktop");
    else setPlatform("Desktop / Mobile Web");

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Capture beforeinstallprompt event for Chromium browsers
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Browser installation prompt not triggered automatically. Please use your browser menu ('Install app' or 'Add to Home Screen').");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6">
      {/* Brand Hero */}
      <div className="border border-border bg-surface p-6 sm:p-8 mb-8">
        <div className="text-xs font-mono text-muted mb-2">OFFICIAL PWA INSTALLER</div>
        <h1 className="text-2xl sm:text-3xl font-mono font-bold text-foreground mb-2">RECALL</h1>
        <p className="text-sm sm:text-base text-muted font-sans max-w-xl">
          “Your computer remembers filenames. RECALL remembers meaning.”
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/"
            className="px-4 py-2 bg-foreground text-background font-mono text-xs font-semibold hover:bg-muted"
          >
            [ Open RECALL ]
          </a>

          {!isInstalled && isInstallable && (
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-accent-blue text-white font-mono text-xs font-semibold hover:bg-blue-600"
            >
              [ Install RECALL ]
            </button>
          )}

          <a
            href="/devices"
            className="px-4 py-2 border border-border bg-surface-raised text-foreground font-mono text-xs hover:border-muted"
          >
            [ Manage Devices ]
          </a>
        </div>
      </div>

      {/* Platform Detection & Secure Instructions */}
      <div className="border border-border bg-surface p-6 mb-8 font-mono text-xs">
        <div className="text-muted mb-1">DETECTED OPERATING SYSTEM:</div>
        <div className="text-foreground text-sm font-bold mb-4">{platform}</div>

        <div className="border-t border-border pt-4 text-muted space-y-3 font-sans text-xs">
          <p className="font-semibold text-foreground font-mono">Browser-Native Progressive Web App (PWA)</p>
          <p>
            RECALL does not distribute untrusted binary executables, installers, or browser plugins. It runs as a sandboxed, zero-malware Progressive Web Application directly within your browser’s secure container.
          </p>

          <div className="bg-background border border-border p-4 font-mono text-xs text-muted space-y-2">
            <div className="text-foreground font-bold">Platform Instructions:</div>
            {platform.includes("Windows") && (
              <p>• Chrome / Edge: Click the install icon in the address bar (or Menu → "Install RECALL"). Launches as an independent desktop window.</p>
            )}
            {platform.includes("macOS") && (
              <p>• Chrome / Safari: Click the install icon in the address bar or File → "Add to Dock".</p>
            )}
            {platform.includes("iOS") || platform.includes("iPad") ? (
              <p>• Safari: Tap the Share button (square with arrow) → Select "Add to Home Screen".</p>
            ) : null}
            {platform.includes("Android") && (
              <p>• Chrome: Tap the three dots (Menu) → Tap "Install app" or "Add to Home screen".</p>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono text-xs">
        <a href="/privacy" className="border border-border p-3 bg-surface hover:border-muted text-muted hover:text-foreground">
          [ Privacy ]
        </a>
        <a href="/security" className="border border-border p-3 bg-surface hover:border-muted text-muted hover:text-foreground">
          [ Security ]
        </a>
        <a href="/terms" className="border border-border p-3 bg-surface hover:border-muted text-muted hover:text-foreground">
          [ Terms ]
        </a>
        <a href="https://github.com/Sarvepalliaudi/RECALL.git" target="_blank" rel="noopener noreferrer" className="border border-border p-3 bg-surface hover:border-muted text-muted hover:text-foreground">
          [ GitHub ]
        </a>
      </div>
    </div>
  );
}

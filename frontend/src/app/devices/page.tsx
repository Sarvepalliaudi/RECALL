"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Device } from "@/types";
import { getStoredDeviceId, getStoredDeviceName } from "@/lib/db";

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [currentDeviceName, setCurrentDeviceName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const id = await getStoredDeviceId();
        const name = await getStoredDeviceName();
        setCurrentDeviceId(id);
        setCurrentDeviceName(name);

        // Register this client device with backend
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
        }).catch(() => {
          // Fallback if not logged in
        });

        const list = await api.listDevices().catch(() => []);
        setDevices(list);
      } catch (err: any) {
        console.error("Device init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleToggleSync = async (device: Device) => {
    try {
      const updated = await api.toggleSync(device.id, !device.sync_enabled);
      setDevices(devices.map((d) => (d.id === updated.id ? updated : d)));
      setStatusMessage(`Sync ${updated.sync_enabled ? "enabled" : "paused"} for ${device.name}.`);
    } catch (err: any) {
      alert(`Could not toggle sync: ${err.message}`);
    }
  };

  const handlePurgeIndex = async (device: Device) => {
    if (
      !confirm(
        `Are you sure you want to purge the indexed memory for '${device.name}'?\n\nNOTE: Original files on this device will NOT be deleted.`
      )
    ) {
      return;
    }
    try {
      const res = await api.purgeDevice(device.id);
      setStatusMessage(res.message);
      // Refresh
      const list = await api.listDevices();
      setDevices(list);
    } catch (err: any) {
      alert(`Error purging index: ${err.message}`);
    }
  };

  const handleUnlinkDevice = async (device: Device) => {
    if (
      !confirm(
        `Unlink '${device.name}' from your RECALL account?\n\nIts cloud index will be deleted, but your local files remain untouched.`
      )
    ) {
      return;
    }
    try {
      const res = await api.unlinkDevice(device.id);
      setStatusMessage(res.message);
      setDevices(devices.filter((d) => d.id !== device.id));
    } catch (err: any) {
      alert(`Error unlinking device: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 font-mono text-xs">
      <div className="border-b border-border pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-muted uppercase">CROSS-DEVICE MEMORY REGISTRY</div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Connected Devices</h1>
        </div>
        <div className="border border-border bg-surface px-3 py-1.5 text-muted flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-emerald inline-block"></span>
          <span>THIS DEVICE: <strong className="text-foreground">{currentDeviceName || "Current Client"}</strong></span>
        </div>
      </div>

      {statusMessage && (
        <div className="border border-accent-emerald/40 bg-emerald-950/40 text-accent-emerald p-3 mb-6 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-muted hover:text-foreground">
            [x]
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted border border-border bg-surface">
          Scanning device registry...
        </div>
      ) : devices.length === 0 ? (
        <div className="border border-border bg-surface p-8 text-center">
          <p className="text-muted mb-4">No remote devices linked yet. This device is currently operating locally.</p>
          <a
            href="/"
            className="px-4 py-2 bg-foreground text-background font-bold hover:bg-muted inline-block"
          >
            [ Start Indexing Files on This Device ]
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const isThisDevice = device.id === currentDeviceId;
            return (
              <div
                key={device.id}
                className="border border-border bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{device.name}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 border border-border bg-background text-muted">
                      {device.platform}
                    </span>
                    {isThisDevice && (
                      <span className="text-[10px] text-accent-emerald bg-emerald-950/80 px-1.5 py-0.5 border border-emerald-800">
                        ACTIVE THIS SESSION
                      </span>
                    )}
                  </div>

                  <div className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span>Last Seen: {new Date(device.last_seen_at).toLocaleString()}</span>
                    <span>Indexed: <strong className="text-foreground">{device.files_indexed}</strong> files</span>
                    <span>Synced: <strong className="text-foreground">{device.files_synced}</strong> files</span>
                    <span>
                      Sync:{" "}
                      <strong className={device.sync_enabled ? "text-accent-emerald" : "text-accent-amber"}>
                        {device.sync_enabled ? "ACTIVE" : "PAUSED"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <button
                    onClick={() => handleToggleSync(device)}
                    className="px-2.5 py-1.5 border border-border bg-surface-raised hover:border-muted text-foreground text-[11px]"
                  >
                    {device.sync_enabled ? "[ Pause Sync ]" : "[ Resume Sync ]"}
                  </button>

                  <button
                    onClick={() => handlePurgeIndex(device)}
                    className="px-2.5 py-1.5 border border-border bg-surface-raised hover:border-accent-amber text-accent-amber text-[11px]"
                  >
                    [ Purge Index ]
                  </button>

                  <button
                    onClick={() => handleUnlinkDevice(device)}
                    className="px-2.5 py-1.5 border border-border bg-surface-raised hover:border-accent-rose text-accent-rose text-[11px]"
                  >
                    [ Unlink ]
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safety Notice */}
      <div className="mt-8 border border-border p-4 bg-background text-muted font-sans text-xs leading-relaxed">
        <strong className="text-foreground font-mono">FILESYSTEM PRIVACY GUARANTEE:</strong>
        <p className="mt-1">
          RECALL indexes file meanings and semantic representations. Unlinking a device or purging an index clears the search database entries on our secure server, but <strong>will never touch, move, or delete files stored locally on your device</strong>.
        </p>
      </div>
    </div>
  );
}

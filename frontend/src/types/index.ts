export type RelevanceTier = "VERY RELEVANT" | "RELEVANT" | "POSSIBLE MATCH";

export type SyncStatus = "local_only" | "index_synced" | "full_synced";

export interface SearchResultItem {
  file_id: string;
  filename: string;
  relative_path: string;
  extension: string;
  size_bytes: number;
  file_modified_at: string | null;
  device_id: string;
  device_name: string;
  device_platform: string;
  sync_status: SyncStatus;
  relevance: RelevanceTier;
  reason: string;
  action_label: "OPEN / DOWNLOAD" | "VIEW INFORMATION";
  matched_snippet: string;
  score: number;
}

export interface ParsedIntent {
  semantic_topic: string;
  detected_types: string[];
  detected_device: string | null;
  time_filter_active: boolean;
}

export interface SearchResponse {
  query: string;
  parsed_intent: ParsedIntent | null;
  total_results: number;
  results: SearchResultItem[];
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  client_type: string;
  is_active: boolean;
  sync_enabled: boolean;
  files_indexed: number;
  files_synced: number;
  last_seen_at: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface PrivacySummary {
  user_email: string;
  account_created: string;
  total_devices_connected: number;
  total_files_indexed: number;
  total_chunks_stored: number;
  total_files_synced: number;
  storage_mode: string;
}

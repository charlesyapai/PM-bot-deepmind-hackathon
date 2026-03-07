import * as FileSystem from 'expo-file-system';
import { MeetingNote } from '../services/api';

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

const CACHE_DIR = `${FileSystem.cacheDirectory}personalbot/`;
const NOTES_DIR = `${FileSystem.documentDirectory}meeting_notes/`;

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ---------------------------------------------------------------------------
// File caching (attachments, downloads)
// ---------------------------------------------------------------------------

/**
 * Download and cache a remote file locally.
 * Returns the local URI of the cached file.
 */
export async function cacheFile(remoteUrl: string, fileName: string): Promise<string> {
  await ensureDir(CACHE_DIR);
  const localUri = `${CACHE_DIR}${fileName}`;
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) {
    return localUri;
  }
  const result = await FileSystem.downloadAsync(remoteUrl, localUri);
  return result.uri;
}

/**
 * Get the local URI of a cached file, or null if not cached.
 */
export async function getCachedFile(fileName: string): Promise<string | null> {
  const localUri = `${CACHE_DIR}${fileName}`;
  const info = await FileSystem.getInfoAsync(localUri);
  return info.exists ? localUri : null;
}

/**
 * Delete all cached files.
 */
export async function clearCache(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  }
}

/**
 * Calculate total cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) return 0;

  const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
  let total = 0;
  for (const file of files) {
    const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
    if (fileInfo.exists && fileInfo.size) {
      total += fileInfo.size;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Meeting note storage (offline access)
// ---------------------------------------------------------------------------

/**
 * Save a meeting note locally for offline access.
 */
export async function saveMeetingNote(id: string, data: MeetingNote): Promise<void> {
  await ensureDir(NOTES_DIR);
  const filePath = `${NOTES_DIR}${id}.json`;
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data));
}

/**
 * Retrieve a locally cached meeting note.
 */
export async function getMeetingNote(id: string): Promise<MeetingNote | null> {
  const filePath = `${NOTES_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists) return null;
  const content = await FileSystem.readAsStringAsync(filePath);
  return JSON.parse(content) as MeetingNote;
}

/**
 * List IDs of all locally cached meeting notes.
 */
export async function listCachedNotes(): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(NOTES_DIR);
  if (!info.exists) return [];
  const files = await FileSystem.readDirectoryAsync(NOTES_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format bytes into a human-readable string (e.g. "12.3 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

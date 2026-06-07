import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

export function formatDate(iso: string | null, relative = false): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (relative) return formatDistanceToNow(d, { addSuffix: true });
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return iso;
  }
}

export function getPathParts(path: string): { label: string; path: string }[] {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const result: { label: string; path: string }[] = [];

  let current = "";
  for (const part of parts) {
    // Windows drive like C:
    if (part.match(/^[A-Za-z]:$/)) {
      current = part + "\\";
      result.push({ label: part + "\\", path: current });
    } else {
      current = current.endsWith("\\") || current.endsWith("/")
        ? current + part
        : current + "\\" + part;
      result.push({ label: part, path: current });
    }
  }
  return result;
}

export function pathJoin(...parts: string[]): string {
  return parts.join("\\").replace(/\\+/g, "\\");
}

export function pathParent(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return path;
  parts.pop();
  const p = parts.join("\\");
  return p.endsWith(":") ? p + "\\" : p;
}

export function pathBasename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

export const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff"]);
export const TEXT_EXTS = new Set(["txt", "md", "json", "ts", "tsx", "js", "jsx", "css", "html", "xml", "yaml", "yml", "toml", "ini", "cfg", "log", "sh", "bat", "ps1", "py", "rs", "go", "java", "c", "cpp", "h", "cs", "rb", "php", "sql"]);
export const VIDEO_EXTS = new Set(["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);
export const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);

export function getFileCategory(ext: string | null): string {
  if (!ext) return "file";
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "image";
  if (TEXT_EXTS.has(e)) return "text";
  if (VIDEO_EXTS.has(e)) return "video";
  if (AUDIO_EXTS.has(e)) return "audio";
  if (ARCHIVE_EXTS.has(e)) return "archive";
  return "file";
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

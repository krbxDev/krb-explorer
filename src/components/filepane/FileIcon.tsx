import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Folder, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, FileJson, Link,
} from "lucide-react";
import type { FileEntry } from "../../lib/types";

// --- Shell icon cache ---
// Files keyed by extension; dirs keyed by path (special folders differ).
const iconCache = new Map<string, string>(); // cache key → data URI (or "" on failure)
const pending = new Map<string, Promise<string>>(); // dedup in-flight fetches

function cacheKey(entry: FileEntry, size: number): string {
  if (entry.isDir) return `dir:${entry.path}:${size}`;
  return `ext:${(entry.extension ?? "").toLowerCase()}:${size}`;
}

async function fetchShellIcon(entry: FileEntry, size: number): Promise<string> {
  try {
    // For files pass a fake absolute path so SHGetFileInfo can find it by extension
    // without needing the file to exist (SHGFI_USEFILEATTRIBUTES).
    // For dirs pass the real path so Windows returns special-folder icons.
    const path = entry.isDir ? entry.path : `C:\\x.${entry.extension ?? "txt"}`;
    const b64 = await invoke<string>("get_icon_data", { path, isDir: entry.isDir, size });
    return b64 ? `data:image/png;base64,${b64}` : "";
  } catch {
    return "";
  }
}

function getShellIcon(entry: FileEntry, size: number): Promise<string> {
  const key = cacheKey(entry, size);
  if (iconCache.has(key)) return Promise.resolve(iconCache.get(key)!);

  let p = pending.get(key);
  if (!p) {
    p = fetchShellIcon(entry, size).then((url) => {
      iconCache.set(key, url);
      pending.delete(key);
      return url;
    });
    pending.set(key, p);
  }
  return p;
}

// --- Lucide fallback (used while loading or when shell lookup fails) ---
const EXT_ICONS: Record<string, React.FC<{ size?: number; color?: string; className?: string }>> = {
  // Text / docs
  txt: FileText, md: FileText, markdown: FileText, log: FileText, csv: FileText,
  ini: FileText, cfg: FileText, conf: FileText, toml: FileText, yaml: FileText, yml: FileText,
  // Data
  json: FileJson, jsonc: FileJson, xml: FileCode,
  // Web / code
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode, mjs: FileCode, cjs: FileCode,
  css: FileCode, scss: FileCode, sass: FileCode, less: FileCode,
  html: FileCode, htm: FileCode, vue: FileCode, svelte: FileCode,
  rs: FileCode, go: FileCode, py: FileCode, java: FileCode,
  c: FileCode, cpp: FileCode, h: FileCode, hpp: FileCode,
  cs: FileCode, rb: FileCode, php: FileCode, kt: FileCode, swift: FileCode, dart: FileCode,
  sh: FileCode, bash: FileCode, zsh: FileCode, fish: FileCode,
  ps1: FileCode, bat: FileCode, cmd: FileCode,
  sql: FileCode, lua: FileCode, r: FileCode, m: FileCode,
  // Archives
  zip: FileArchive, rar: FileArchive, "7z": FileArchive, tar: FileArchive,
  gz: FileArchive, bz2: FileArchive, xz: FileArchive, zst: FileArchive,
  cab: FileArchive, iso: FileArchive, img: FileArchive,
  // Images
  jpg: FileImage, jpeg: FileImage, png: FileImage, gif: FileImage,
  bmp: FileImage, webp: FileImage, ico: FileImage, svg: FileImage,
  tiff: FileImage, tif: FileImage, avif: FileImage, heic: FileImage, heif: FileImage,
  raw: FileImage, cr2: FileImage, nef: FileImage, arw: FileImage,
  // Video
  mp4: FileVideo, mkv: FileVideo, avi: FileVideo, mov: FileVideo, webm: FileVideo,
  m4v: FileVideo, wmv: FileVideo, flv: FileVideo, mpg: FileVideo,
  mpeg: FileVideo, "3gp": FileVideo, ogv: FileVideo,
  // Audio
  mp3: FileAudio, wav: FileAudio, ogg: FileAudio, flac: FileAudio, m4a: FileAudio,
  aac: FileAudio, wma: FileAudio, opus: FileAudio, aiff: FileAudio, ape: FileAudio,
};

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6",
  js: "#f7df1e", jsx: "#f7df1e",
  json: "#f97316", jsonc: "#f97316",
  rs: "#ce422b", py: "#3776ab", go: "#00add8",
  md: "#a0a0b8",
  css: "#2965f1", html: "#e34c26", scss: "#c6538c",
  zip: "#f59e0b", rar: "#f59e0b", "7z": "#f59e0b",
  jpg: "#22c55e", jpeg: "#22c55e", png: "#22c55e", gif: "#22c55e", webp: "#22c55e",
  mp4: "#8b5cf6", mkv: "#8b5cf6",
  mp3: "#ec4899", wav: "#ec4899", flac: "#ec4899",
  cs: "#68217a", java: "#b07219", php: "#777bb4", rb: "#cc342d",
};

interface Props {
  entry: FileEntry;
  size?: number;
  open?: boolean;
}

function LucideIcon({ entry, size, open }: Props) {
  if (entry.isSymlink) return <Link size={size} className="text-[var(--text-accent)]" />;
  if (entry.isDir) {
    const Icon = open ? FolderOpen : Folder;
    return <Icon size={size} className="text-[#f4b942]" />;
  }
  const ext = (entry.extension ?? "").toLowerCase();
  const Icon = EXT_ICONS[ext] ?? File;
  const color = EXT_COLORS[ext] ?? "var(--text-muted)";
  return <Icon size={size} color={color} />;
}

export function FileIcon({ entry, size = 16, open = false }: Props) {
  const key = cacheKey(entry, size);
  const [src, setSrc] = useState<string>(() => iconCache.get(key) ?? "");

  useEffect(() => {
    // Symlinks don't get shell icons — lucide arrow conveys the type clearly
    if (entry.isSymlink) return;

    if (iconCache.has(key)) {
      const cached = iconCache.get(key)!;
      setSrc(cached);
      return;
    }

    let alive = true;
    getShellIcon(entry, size).then((url) => {
      if (alive) setSrc(url);
    });
    return () => { alive = false; };
  }, [key]);

  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt=""
        style={{ imageRendering: "pixelated", objectFit: "contain", display: "block", flexShrink: 0 }}
      />
    );
  }

  return <LucideIcon entry={entry} size={size} open={open} />;
}

import {
  Folder, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, FileJson, Package, Link, AlertCircle
} from "lucide-react";
import type { FileEntry } from "../../lib/types";
import { getFileCategory } from "../../lib/utils";

interface Props {
  entry: FileEntry;
  size?: number;
  open?: boolean;
}

const EXT_ICONS: Record<string, React.FC<{ size?: number; className?: string; color?: string }>> = {
  txt: FileText, md: FileText, log: FileText,
  json: FileJson, jsonc: FileJson,
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  css: FileCode, html: FileCode, htm: FileCode, xml: FileCode,
  rs: FileCode, go: FileCode, py: FileCode, java: FileCode, c: FileCode,
  cpp: FileCode, h: FileCode, cs: FileCode, rb: FileCode, php: FileCode,
  zip: FileArchive, rar: FileArchive, "7z": FileArchive, tar: FileArchive, gz: FileArchive,
  jpg: FileImage, jpeg: FileImage, png: FileImage, gif: FileImage,
  bmp: FileImage, webp: FileImage, svg: FileImage, ico: FileImage,
  mp4: FileVideo, mkv: FileVideo, avi: FileVideo, mov: FileVideo, webm: FileVideo,
  mp3: FileAudio, wav: FileAudio, ogg: FileAudio, flac: FileAudio, m4a: FileAudio,
};

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6",
  js: "#f7df1e", jsx: "#f7df1e",
  json: "#f97316", jsonc: "#f97316",
  rs: "#ce422b",
  py: "#3776ab",
  go: "#00add8",
  md: "#a0a0b8",
  css: "#2965f1", html: "#e34c26",
  zip: "#f59e0b", rar: "#f59e0b", "7z": "#f59e0b",
  jpg: "#22c55e", jpeg: "#22c55e", png: "#22c55e", gif: "#22c55e", webp: "#22c55e",
  mp4: "#8b5cf6", mkv: "#8b5cf6",
  mp3: "#ec4899", wav: "#ec4899",
};

export function FileIcon({ entry, size = 16, open = false }: Props) {
  if (entry.isSymlink) {
    return <Link size={size} className="text-[var(--text-accent)]" />;
  }

  if (entry.isDir) {
    const Icon = open ? FolderOpen : Folder;
    return <Icon size={size} className="text-[#f4b942]" />;
  }

  const ext = entry.extension?.toLowerCase() ?? "";
  const Icon = EXT_ICONS[ext] ?? File;
  const color = EXT_COLORS[ext] ?? "var(--text-muted)";

  return <Icon size={size} color={color} />;
}

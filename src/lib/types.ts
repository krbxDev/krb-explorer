export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  isHidden: boolean;
  size: number;
  modified: string | null;
  created: string | null;
  extension: string | null;
  readonly: boolean;
  iconType: string;
  gitStatus?: string;
  ntfsCompressed?: boolean;
  ntfsEncrypted?: boolean;
  isSystem?: boolean;
}

export interface ConflictInfo {
  sourcePath: string;
  destPath: string;
  sourceName: string;
  sourceSize: number;
  sourceModified: string | null;
  destSize: number;
  destModified: string | null;
}

export type ConflictResolution = 'replace' | 'skip' | 'keepBoth';

export interface FileProperties {
  path: string;
  name: string;
  fileType: string;
  location: string;
  size: number;
  sizeOnDisk: number;
  created: string | null;
  modified: string | null;
  accessed: string | null;
  isReadonly: boolean;
  isHidden: boolean;
  isSystem: boolean;
  isArchiveAttr: boolean;
  isCompressed: boolean;
  isEncrypted: boolean;
  isDir: boolean;
  itemCount: number | null;
}

export interface OpenWithApp {
  name: string;
  exePath: string;
  displayName: string;
}

export type OperationKind = 'copy' | 'move' | 'rename' | 'delete' | 'create';
export interface OperationRecord {
  id: string;
  kind: OperationKind;
  sources: string[];
  dest?: string;
  oldName?: string;
  newName?: string;
  timestamp: number;
}

export interface DriveInfo {
  name: string;
  path: string;
  label: string | null;
  driveType: string;
  totalSpace: number;
  freeSpace: number;
}

export interface SearchResult {
  path: string;
  name: string;
  isDir: boolean;
  score: number;
  size: number;
  modified: string | null;
}

export interface Favorite {
  id: number;
  path: string;
  name: string;
  orderIndex: number;
  isSearch: boolean;
  searchQuery: string | null;
}

export interface HistoryEntry {
  id: number;
  path: string;
  visitedAt: string;
  isFile: boolean;
}

export interface ArchiveEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  modified: string | null;
}

export type SortKey = 'name' | 'size' | 'modified' | 'type';
export type ViewMode = 'list' | 'grid' | 'details' | 'columns';

export interface ColumnDef {
  key: SortKey | string;
  label: string;
  width: number;
  minWidth?: number;
}

export interface PaneState {
  id: string;
  path: string;
  history: string[];
  historyIndex: number;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  selection: Set<string>;
  sortKey: SortKey;
  sortAsc: boolean;
  showHidden: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  gitStatus: Record<string, string>;
  isGitRepo: boolean;
  gitBranch: string | null;
  isArchive: boolean;
  archivePath: string | null;
}

export interface Tab {
  id: string;
  label: string;
  paneId: string;
  pinned: boolean;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  disabled?: boolean;
  action: () => void;
}

export interface CopyProgress {
  current: number;
  total: number;
  file: string;
  done: boolean;
  pct?: number;
}

export interface DiskUsageNode {
  name: string;
  path: string;
  size: number;
  children: DiskUsageNode[];
}

export interface BookmarkedSearch {
  id: string;
  name: string;
  query: string;
  root: string;
}

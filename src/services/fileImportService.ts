import { File } from 'expo-file-system';

const MAX_FILE_SIZE = 1_000_000; // 1MB
const VALID_EXTENSIONS = ['.txt', '.md', '.markdown'];

export interface FileImportResult {
  success: boolean;
  markdown?: string;
  fileName?: string;
  error?: string;
}

/**
 * Convert a URL to a file:// URL.
 * iOS "Open In" / share sends URLs using the app's custom scheme (liftmark://)
 * rather than file://, so we need to normalize them.
 */
function toFileUrl(url: string): string | null {
  if (url.startsWith('file://')) return url;
  if (url.startsWith('liftmark://')) {
    const path = url.replace('liftmark://', '');
    return `file:///${path}`;
  }
  return null;
}

/**
 * Check if a URL is a file import URL with a valid text/markdown extension.
 * Accepts both file:// and liftmark:// scheme URLs.
 */
export function isFileImportUrl(url: string): boolean {
  const fileUrl = toFileUrl(url);
  if (!fileUrl) return false;
  const path = decodeURIComponent(fileUrl.replace('file://', ''));
  const lower = path.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Read a shared file from a file:// or liftmark:// URL and return its content.
 */
export async function readSharedFile(url: string): Promise<FileImportResult> {
  try {
    const fileUrl = toFileUrl(url);
    if (!fileUrl) {
      return { success: false, error: 'Unsupported URL scheme.' };
    }
    const path = decodeURIComponent(fileUrl.replace('file://', ''));
    const fileName = path.split('/').pop() || 'unknown';

    if (!VALID_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) {
      return { success: false, error: 'Unsupported file type. Only .txt, .md, and .markdown files are supported.' };
    }

    const file = new File(fileUrl);

    if (!file.exists) {
      return { success: false, error: 'File not found.' };
    }

    const size = file.size;
    if (size === 0) {
      return { success: false, error: 'File is empty.' };
    }
    if (size > MAX_FILE_SIZE) {
      return { success: false, error: 'File is too large (max 1MB).' };
    }

    const content = file.textSync();

    if (!content.trim()) {
      return { success: false, error: 'File is empty.' };
    }

    return { success: true, markdown: content, fileName };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file';
    return { success: false, error: message };
  }
}

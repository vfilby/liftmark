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
 * Check if a URL is a file:// URL with a valid text/markdown extension.
 */
export function isFileImportUrl(url: string): boolean {
  if (!url.startsWith('file://')) return false;
  const path = decodeURIComponent(url.replace('file://', ''));
  const lower = path.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Read a shared file from a file:// URL and return its content.
 */
export async function readSharedFile(url: string): Promise<FileImportResult> {
  try {
    const path = decodeURIComponent(url.replace('file://', ''));
    const fileName = path.split('/').pop() || 'unknown';

    if (!VALID_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))) {
      return { success: false, error: 'Unsupported file type. Only .txt, .md, and .markdown files are supported.' };
    }

    const file = new File(url);

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

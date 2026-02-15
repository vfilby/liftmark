import { isFileImportUrl, readSharedFile } from '../services/fileImportService';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  File: jest.fn(),
}));

import { File } from 'expo-file-system';

const MockFile = File as jest.MockedClass<typeof File>;

describe('fileImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isFileImportUrl', () => {
    it('returns true for .md file URL', () => {
      expect(isFileImportUrl('file:///path/to/workout.md')).toBe(true);
    });

    it('returns true for .txt file URL', () => {
      expect(isFileImportUrl('file:///path/to/workout.txt')).toBe(true);
    });

    it('returns true for .markdown file URL', () => {
      expect(isFileImportUrl('file:///path/to/workout.markdown')).toBe(true);
    });

    it('returns true regardless of case', () => {
      expect(isFileImportUrl('file:///path/to/workout.MD')).toBe(true);
      expect(isFileImportUrl('file:///path/to/workout.TXT')).toBe(true);
    });

    it('returns true for liftmark:// file URLs', () => {
      expect(isFileImportUrl('liftmark://private/var/mobile/Containers/Data/Application/123/Documents/Inbox/workout.md')).toBe(true);
      expect(isFileImportUrl('liftmark://private/var/mobile/Containers/Data/Application/123/Documents/Inbox/workout.txt')).toBe(true);
    });

    it('returns false for liftmark:// URLs without file extensions', () => {
      expect(isFileImportUrl('liftmark://import')).toBe(false);
    });

    it('returns false for non-file URLs', () => {
      expect(isFileImportUrl('https://example.com/file.md')).toBe(false);
    });

    it('returns false for unsupported extensions', () => {
      expect(isFileImportUrl('file:///path/to/file.pdf')).toBe(false);
      expect(isFileImportUrl('file:///path/to/file.json')).toBe(false);
      expect(isFileImportUrl('file:///path/to/file.csv')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFileImportUrl('')).toBe(false);
    });

    it('handles URL-encoded paths', () => {
      expect(isFileImportUrl('file:///path/to/my%20workout.md')).toBe(true);
    });
  });

  describe('readSharedFile', () => {
    function mockFile(overrides: { exists?: boolean; size?: number; text?: string } = {}) {
      const { exists = true, size = 100, text = '# Push Day\n- 135 x 10' } = overrides;
      MockFile.mockImplementation(() => ({
        exists,
        size,
        textSync: () => text,
      }) as any);
    }

    it('reads a valid .md file successfully', async () => {
      const content = '# Push Day\n- 135 x 10';
      mockFile({ text: content });

      const result = await readSharedFile('file:///path/to/workout.md');

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(content);
      expect(result.fileName).toBe('workout.md');
    });

    it('reads a valid .txt file successfully', async () => {
      mockFile({ text: '# Leg Day' });

      const result = await readSharedFile('file:///path/to/workout.txt');

      expect(result.success).toBe(true);
      expect(result.markdown).toBe('# Leg Day');
      expect(result.fileName).toBe('workout.txt');
    });

    it('returns error for unsupported extension', async () => {
      const result = await readSharedFile('file:///path/to/file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('returns error when file does not exist', async () => {
      mockFile({ exists: false });

      const result = await readSharedFile('file:///path/to/missing.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found.');
    });

    it('returns error for empty file (size 0)', async () => {
      mockFile({ size: 0 });

      const result = await readSharedFile('file:///path/to/empty.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File is empty.');
    });

    it('returns error for file exceeding 1MB', async () => {
      mockFile({ size: 1_500_000 });

      const result = await readSharedFile('file:///path/to/huge.md');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('returns error for whitespace-only content', async () => {
      mockFile({ text: '   \n\n  ' });

      const result = await readSharedFile('file:///path/to/blank.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File is empty.');
    });

    it('handles URL-encoded file names', async () => {
      mockFile({ text: '# Workout' });

      const result = await readSharedFile('file:///path/to/my%20workout.md');

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('my workout.md');
    });

    it('reads a file from liftmark:// URL', async () => {
      const content = '# Push Day\n- 135 x 10';
      mockFile({ text: content });

      const result = await readSharedFile('liftmark://private/var/mobile/Containers/Data/Application/123/Documents/Inbox/workout.md');

      expect(result.success).toBe(true);
      expect(result.markdown).toBe(content);
      expect(result.fileName).toBe('workout.md');
      expect(MockFile).toHaveBeenCalledWith('file:///private/var/mobile/Containers/Data/Application/123/Documents/Inbox/workout.md');
    });

    it('returns error for unsupported URL scheme', async () => {
      const result = await readSharedFile('https://example.com/workout.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported URL scheme.');
    });

    it('handles exceptions gracefully', async () => {
      MockFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await readSharedFile('file:///path/to/workout.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});

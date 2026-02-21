# File Import Service Specification

## Purpose

Read shared files from the iOS "Open In" dialog or share sheet into the app. This enables users to import LMWF workout plan files from other apps or file sources.

## Public API

### `isFileImportUrl(url: string): boolean`

Check if a URL is a valid file import URL that this service can handle.

### `readSharedFile(url: string): Promise<FileImportResult>`

Read the contents of a shared file. Returns a result object with the file content or an error description.

### FileImportResult

```
{
  success: boolean
  markdown?: string
  fileName?: string
  error?: string
}
```

## Behavior Rules

### URL Schemes

- `file://` URLs are accepted directly.
- `liftmark://` URLs are accepted and converted to `file://` by replacing the scheme prefix.

### Valid File Extensions

The following extensions are accepted (case-insensitive):
- `.txt`
- `.md`
- `.markdown`

### File Size Limit

Maximum file size is 1 MB.

### File Reading

Files are read synchronously using `File.textSync()`.

### Validation Sequence

1. Check URL scheme is `file://` or `liftmark://`.
2. Check file extension is in the allowed list.
3. Check file exists.
4. Check file is not empty (size 0 or whitespace-only content).
5. Check file does not exceed the size limit.
6. Attempt to read file content.

## Error Cases

| Condition | Error Message |
|---|---|
| Unsupported URL scheme | Error indicating the URL scheme is not supported |
| Unsupported file type | Error indicating the file extension is not supported |
| File not found | Error indicating the file could not be found |
| File empty (0 bytes or whitespace only) | Error indicating the file is empty |
| File too large (>1 MB) | Error indicating the file exceeds the size limit |
| Read failure | Error with the underlying failure message |

## Dependencies

- `expo-file-system` (`File`) for file access and reading.

## Platform Requirements

- iOS (share sheet / "Open In" integration).

## Error Handling

The service returns structured `FileImportResult` objects with `success: false` and a descriptive `error` string for all failure cases. It does not throw exceptions for expected error conditions.

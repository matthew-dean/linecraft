// Utility for creating clickable file links in terminals (OSC 8)

/**
 * Creates a clickable file link using ANSI OSC 8 escape sequences
 * 
 * Modern terminals (VS Code, iTerm2, etc.) support clickable links using OSC 8.
 * Format: \x1b]8;;<url>\x1b\\<text>\x1b]8;;\x1b\\
 * 
 * @param url - The full file path (will be converted to file:// URL)
 * @param text - The visible text to display
 * @returns ANSI-encoded string with clickable link
 * 
 * @example
 * fileLink('/Users/me/project/src/file.ts', 'src/file.ts')
 * // Returns: \x1b]8;;file:///Users/me/project/src/file.ts\x1b\\src/file.ts\x1b]8;;\x1b\\
 */
export function fileLink(url: string, text: string): string {
  // Convert file path to file:// URL
  // On Windows, we'd need to handle drive letters, but for now assume Unix-style paths
  const fileUrl = url.startsWith('/') ? `file://${url}` : `file:///${url}`;
  
  // OSC 8 format: \x1b]8;;<url>\x1b\\<text>\x1b]8;;\x1b\\
  return `\x1b]8;;${fileUrl}\x1b\\${text}\x1b]8;;\x1b\\`;
}


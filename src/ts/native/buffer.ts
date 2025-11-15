// Render buffer for batching ANSI operations - TypeScript implementation
// Optimized for Node.js stdout writes

/**
 * RenderBuffer batches ANSI operations to minimize syscalls.
 * 
 * Node.js stdout.write() is buffered, but batching multiple operations
 * into a single write is still more efficient than multiple small writes.
 */
export class RenderBuffer {
  private buffer: string = '';
  private readonly stdout: NodeJS.WriteStream;

  constructor(stdout: NodeJS.WriteStream = process.stdout) {
    this.stdout = stdout;
  }

  /**
   * Append data to the buffer (does not write immediately)
   */
  write(data: string): void {
    this.buffer += data;
  }

  /**
   * Flush all buffered data to stdout in a single write.
   * This minimizes syscalls and improves performance.
   * 
   * Note: process.stdout.write() is synchronous by default (blocks until written),
   * so we don't need writeSync. For tests, we can mock stdout.write.
   */
  flush(): void {
    if (this.buffer.length > 0) {
      // process.stdout.write() is synchronous and blocks until written
      // This is fine for terminal output where we want immediate rendering
      this.stdout.write(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Clear the buffer without writing
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * Get current buffer size (for debugging)
   */
  get size(): number {
    return this.buffer.length;
  }
}


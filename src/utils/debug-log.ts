// Shared debug logging utility - singleton pattern
// All files should use this instead of duplicating logging code

import * as fs from 'fs';
import * as path from 'path';

class DebugLog {
  private static instance: DebugLog | null = null;
  private logPath: string;
  private cleared: boolean = false;

  private constructor() {
    this.logPath = path.join(process.cwd(), 'linecraft-debug.log');
  }

  static getInstance(): DebugLog {
    if (!DebugLog.instance) {
      DebugLog.instance = new DebugLog();
    }
    return DebugLog.instance;
  }

  log(message: string): void {
    try {
      // Clear log file on first write
      if (!this.cleared) {
        fs.writeFileSync(
          this.logPath,
          `# Linecraft Debug Log\n# This file will be appended to during rendering operations\n# Monitor this file to see debug output from expandTo() and renderNow()\n\n`
        );
        this.cleared = true;
      }

      const timestamp = new Date().toISOString();
      fs.appendFileSync(this.logPath, `[${timestamp}] ${message}\n`);
    } catch (err) {
      // Silently fail - don't break functionality if logging fails
    }
  }
}

export function logToFile(message: string): void {
  DebugLog.getInstance().log(message);
}


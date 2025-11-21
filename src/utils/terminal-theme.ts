// Terminal theme detection utilities

/**
 * Detect if the terminal has a dark or light background
 * 
 * Uses the COLORFGBG environment variable which has format "foreground;background"
 * where background values 0-7 indicate dark background, 8-15 indicate light background.
 * 
 * If COLORFGBG is not available, defaults to assuming dark background (most common).
 * 
 * @returns true if terminal has dark background, false if light
 */
export function isDarkTerminal(): boolean {
  const colorfgbg = process.env.COLORFGBG;
  if (!colorfgbg) {
    // Default to dark (most terminals are dark)
    return true;
  }
  
  // COLORFGBG format: "foreground;background" or just "background"
  const parts = colorfgbg.split(';');
  const background = parts.length > 1 ? parts[1] : parts[0];
  const bgNum = parseInt(background, 10);
  
  if (isNaN(bgNum)) {
    // Can't parse, default to dark
    return true;
  }
  
  // Background values 0-7 = dark, 8-15 = light
  return bgNum < 8;
}

/**
 * Get an appropriate muted color for line numbers based on terminal theme
 * 
 * On dark terminals: returns 'brightBlack' (muted gray, visible but not prominent)
 * On light terminals: returns 'black' (darker gray, visible but not prominent)
 * 
 * These colors provide good contrast while remaining subtle and not distracting
 * from the main code content.
 * 
 * @returns Color name suitable for line numbers
 */
export function getLineNumberColor(): 'black' | 'brightBlack' {
  // On dark terminals, use brightBlack (muted gray) for visibility
  // On light terminals, use black (darker gray) for visibility
  return isDarkTerminal() ? 'brightBlack' : 'black';
}


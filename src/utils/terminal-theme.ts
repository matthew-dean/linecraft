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
 * On dark terminals: returns 'brightBlack' (will be dimmed for less contrast)
 * On light terminals: returns 'black' (darker gray, less contrasty)
 * 
 * These colors provide minimal contrast while remaining subtle and not distracting
 * from the main code content. On dark terminals, the color should be applied with
 * dim=true to reduce contrast further.
 * 
 * @returns Color name suitable for line numbers
 */
export function getLineNumberColor(): 'black' | 'brightBlack' {
  // On dark terminals, use brightBlack (will be dimmed for less contrast)
  // On light terminals, use black (darker gray, less contrasty)
  return isDarkTerminal() ? 'brightBlack' : 'black';
}

/**
 * Get a colored line number color based on terminal theme
 * 
 * On dark terminals: returns 'blue' (muted, less contrasty blue)
 * On light terminals: returns 'brightBlue' (muted, less contrasty blue)
 * 
 * This provides a subtle, less contrasty color for line numbers that still
 * has a blue shade, working well in both dark and light terminal themes.
 * 
 * @returns Color name suitable for colored line numbers
 */
export function getColoredLineNumberColor(): 'blue' | 'brightBlue' {
  // On dark terminals, use blue (muted, less contrasty than cyan)
  // On light terminals, use brightBlue (lighter, less contrasty than blue)
  return isDarkTerminal() ? 'blue' : 'brightBlue';
}


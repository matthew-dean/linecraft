// Prompt component - improved API for prompts like "Press SPACEBAR"

import type { TerminalRegion } from '../region';
import type { Color } from '../types';
import { Styled } from './styled';

export interface PromptOptions {
  message: string;
  key?: string; // e.g., 'SPACEBAR', 'ENTER', 'Q'
  color?: Color;
  position?: 'below' | 'above'; // Position relative to region
}

/**
 * Show a prompt message (like "Press SPACEBAR to continue...")
 * This is a better API than waitForSpacebar for general prompts
 */
export async function showPrompt(
  region: TerminalRegion,
  options: PromptOptions
): Promise<void> {
  const {
    message,
    key = 'SPACEBAR',
    color: promptColor = 'brightBlack',
    position = 'below',
  } = options;

  const currentHeight = region.height;
  // Use Styled component and render it to get the styled string
  const styleComponent = Styled({ color: promptColor }, `Press ${key} to ${message}...`);
  const promptText = styleComponent({
    availableWidth: Infinity, // No width constraint for prompt text
    region: region,
    columnIndex: 0,
    rowIndex: 0,
  });
  
  // Styled() returns string | string[] | null, we need a string
  const promptString = typeof promptText === 'string' ? promptText : (Array.isArray(promptText) ? promptText[0] : '');

  if (position === 'below') {
    // Add blank line, then prompt
    region.setLine(currentHeight + 1, '');
    region.setLine(currentHeight + 2, promptString);
  } else {
    // Add prompt above current content
    // This would require shifting all content down, which is complex
    // For now, just add below
    region.setLine(currentHeight + 1, '');
    region.setLine(currentHeight + 2, promptString);
  }

  region.flush();

  // Wait for keypress
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      resolve();
      return;
    }

    let rawMode = false;
    try {
      rawMode = stdin.isRaw || false;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
    } catch (err) {
      // EIO error - stdin not available
      resolve();
      return;
    }

    const onData = (key: string) => {
      // Handle spacebar, enter, or 'q'
      if (key === ' ' || key === '\r' || key === '\n' || key === 'q' || key === 'Q') {
        cleanup();
        resolve();
      }
      // Handle Ctrl+C
      if (key === '\u0003') {
        cleanup();
        process.exit(0);
      }
    };

    const onSIGINT = () => {
      cleanup();
      process.exit(0);
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      // CRITICAL: Remove SIGINT listener to prevent memory leak
      // Use removeListener instead of once to ensure we can clean it up
      process.removeListener('SIGINT', onSIGINT);
      try {
        stdin.setRawMode(rawMode);
        stdin.pause();
      } catch (err) {
        // Ignore errors
      }
    };

    stdin.on('data', onData);
    // Use on() instead of once() so we can remove it in cleanup
    process.on('SIGINT', onSIGINT);
  });
}


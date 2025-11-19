// Prompt utility - wait for user input with readable key names

import type { TerminalRegion } from '../region';
import type { Color } from '../types';
import { Styled } from '../components/styled';

export interface PromptOptions {
  message?: string; // e.g., 'continue', 'proceed', 'next'
  key?: 'spacebar' | 'enter' | 'q' | 'any'; // Key to wait for
  color?: Color;
}

/**
 * Map readable key names to actual key codes
 */
function getKeyCode(key: 'spacebar' | 'enter' | 'q' | 'any'): string[] {
  switch (key) {
    case 'spacebar':
      return [' '];
    case 'enter':
      return ['\r', '\n'];
    case 'q':
      return ['q', 'Q'];
    case 'any':
      return []; // Empty means accept any key
    default:
      return [' '];
  }
}

/**
 * Get display name for key
 */
function getKeyDisplayName(key: 'spacebar' | 'enter' | 'q' | 'any'): string {
  switch (key) {
    case 'spacebar':
      return 'SPACEBAR';
    case 'enter':
      return 'ENTER';
    case 'q':
      return 'Q';
    case 'any':
      return 'any key';
    default:
      return 'SPACEBAR';
  }
}

/**
 * Wait for user to press a key before continuing
 * 
 * Shows a prompt message and waits for the specified key press.
 * Integrates with the region to show the prompt and cursor properly.
 */
export async function prompt(
  region: TerminalRegion,
  options: PromptOptions = {}
): Promise<void> {
  const {
    message = 'continue',
    key = 'spacebar',
    color: promptColor = 'brightBlack',
  } = options;

  const keyDisplayName = getKeyDisplayName(key);
  const keyCodes = getKeyCode(key);

  // Prepare prompt inside region before listening for input
  // Use Styled component to render the prompt text with color
  const styleComponent = Styled({ color: promptColor }, `Press ${keyDisplayName} to ${message}...`);
  const promptResult = styleComponent({
    availableWidth: Infinity,
    region: region,
    columnIndex: 0,
    rowIndex: 0,
  });
  const promptText = typeof promptResult === 'string' ? promptResult : (Array.isArray(promptResult) ? promptResult[0] : '');
  
  // Add prompt and get reference so we can clear it later
  const promptSection = region.add(['', promptText]);
  await region.flush();
  
  const promptLineNumber = region.height;
  // Calculate column position: strip ANSI codes to get actual text length
  const plainText = promptText.replace(/\x1b\[[0-9;]*m/g, '');
  const promptColumn = plainText.length + 1;
  region.showCursorAt(promptLineNumber, promptColumn);

  return new Promise((resolve) => {
    // Set stdin to raw mode to capture individual keypresses
    if (!process.stdin.isTTY) {
      // If not a TTY, just resolve immediately
      resolve();
      return;
    }
    
    // Try to set raw mode, but handle errors gracefully
    let rawMode = false;
    try {
      rawMode = process.stdin.isRaw || false;
      process.stdin.setRawMode(true);
    } catch (err) {
      // If setRawMode fails (e.g., stdin is closed or not available), just resolve
      resolve();
      return;
    }
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const onKeyPress = (keyPress: string) => {
      // Check if this key matches what we're waiting for
      const matches = keyCodes.length === 0 || keyCodes.includes(keyPress);
      
      if (matches) {
        // Delete the prompt lines completely
        promptSection.delete();
        cleanup();
        resolve();
      } else if (keyPress === '\u0003') { // \u0003 is Ctrl+C
        // Ctrl+C should exit immediately and restore terminal state
        // Delete prompt before exiting
        promptSection.delete();
        cleanup();
        process.exit(130); // Standard exit code for SIGINT
      }
    };
    
    const onSIGINT = () => {
      // Delete prompt before cleanup
      promptSection.delete();
      cleanup();
      resolve();
    };
    
    const cleanup = () => {
      try {
        process.stdin.setRawMode(rawMode);
      } catch (err) {
        // Ignore errors when restoring raw mode
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
      // CRITICAL: Remove SIGINT listener to prevent memory leak
      process.removeListener('SIGINT', onSIGINT);
      region.hideCursor();
    };
    
    // Handle Ctrl+C explicitly
    process.on('SIGINT', onSIGINT);
    
    process.stdin.on('data', onKeyPress);
  });
}


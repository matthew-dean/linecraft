// Prompt component - improved API for prompts like "Press SPACEBAR"

import type { TerminalRegion } from '../region';
import type { Color } from '../types';
import type { Component } from '../component';
import { Styled } from './styled';

export interface PromptOptions {
  message: string;
  key?: string; // e.g., 'SPACEBAR', 'ENTER', 'Q'
  color?: Color;
}

/**
 * Create a Prompt component that can be added to a region
 * The component renders a blank line followed by the prompt message
 */
export function Prompt(options: PromptOptions): Component {
  const {
    message,
    key = 'SPACEBAR',
    color: promptColor = 'brightBlack',
  } = options;

  return (ctx) => {
    const promptText = `Press ${key} to ${message}...`;
    const styledComponent = Styled({ color: promptColor }, promptText);
    const styledResult = styledComponent(ctx);
    
    // Return blank line + prompt
    if (typeof styledResult === 'string') {
      return ['', styledResult];
    } else if (Array.isArray(styledResult)) {
      return ['', ...styledResult];
  } else {
      return ['', promptText];
  }
  };
}

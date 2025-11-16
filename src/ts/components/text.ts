// Text component with overflow handling

import { Component } from './base';
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from '../utils/text';
import type { TerminalRegion } from '../region';

export type TextOverflow = 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap';

export class Text extends Component {
  private content: string;
  private overflow: TextOverflow = 'ellipsis-end';
  private align: 'left' | 'center' | 'right' = 'left';

  constructor(
    region: TerminalRegion,
    content: string,
    options: TextOptions = {}
  ) {
    super(region, options);
    this.content = content;
    this.overflow = options.overflow ?? 'ellipsis-end';
    this.align = options.align ?? 'left';
  }

  setContent(content: string): void {
    this.content = content;
  }

  getPreferredWidth(): number {
    return this.content.length;
  }

  getHeight(): number {
    if (this.overflow === 'wrap') {
      const width = this.width ?? this.getPreferredWidth();
      return wrapText(this.content, width).length;
    }
    return 1;
  }

  render(x: number, y: number, width: number): void {
    let text = this.content;
    
    // Handle overflow
    if (this.overflow === 'ellipsis-end' && text.length > width) {
      text = truncateEnd(text, width);
    } else if (this.overflow === 'ellipsis-start' && text.length > width) {
      text = truncateStart(text, width);
    } else if (this.overflow === 'ellipsis-middle' && text.length > width) {
      text = truncateMiddle(text, width);
    } else if (this.overflow === 'wrap') {
      const lines = wrapText(text, width);
      for (let i = 0; i < lines.length; i++) {
        this.region.setLine(y + i, this.alignText(lines[i], width));
      }
      return;
    }

    // Handle alignment
    text = this.alignText(text, width);
    
    this.region.setLine(y, text);
  }

  private alignText(text: string, width: number): string {
    if (this.align === 'left') {
      return text.padEnd(width, ' ');
    } else if (this.align === 'right') {
      return text.padStart(width, ' ');
    } else { // center
      const padding = width - text.length;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }
  }
}

export interface TextOptions {
  overflow?: TextOverflow;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
  maxWidth?: number;
  flexGrow?: number;
  flexShrink?: number;
  width?: number;
}


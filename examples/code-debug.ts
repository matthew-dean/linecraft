// Demo showing CodeDebug component with various scenarios

import { Region, CodeDebug, prompt } from '../src/index';
import * as path from 'path';

async function main() {
  const r = Region({ debugLog: 'debug.log' });
  const baseDir = process.cwd();

  // Example 1: Simple error at start of line
  r.set(
    CodeDebug({
      startLine: 5,
      startColumn: 1,
      errorLine: 'const x = undefined;',
      message: 'Variable is declared but never used',
      filePath: 'src/utils/helper.ts',
      fullPath: path.join(baseDir, 'src/utils/helper.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 2: Error with range (underline) - underlining the variable "x + y"
  r.set(
    CodeDebug({
      startLine: 12,
      startColumn: 12,
      endLine: 12,
      endColumn: 16,
      errorLine: '    return x + y + z;', 
      message: 'Type error: cannot add string and number',
      filePath: 'src/math/calculator.ts',
      fullPath: path.join(baseDir, 'src/math/calculator.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 3: Warning with context (before and after lines)
  r.set(
    CodeDebug({
      startLine: 8,
      startColumn: 5,
      errorLine: '    if (condition) {',
      lineBefore: '  function processData() {',
      lineAfter: '      doSomething();',
      message: 'Consider using early return pattern for better readability',
      filePath: 'src/processors/data.ts',
      fullPath: path.join(baseDir, 'src/processors/data.ts'),
      baseDir,
      type: 'warning',
    })
  );
  await prompt(r);

  // Example 4: Long line that needs truncation - underlining "andEvenMoreParameters"
  r.set(
    CodeDebug({
      startLine: 42,
      startColumn: 80,
      endLine: 42,
      endColumn: 100,
      errorLine: 'const veryLongVariableName = someVeryLongFunctionCall(withManyParameters, andMoreParameters, andEvenMoreParameters, thatMakeThisLineExtremelyLong, soLongThatItNeedsTruncation)',
      message: 'Line exceeds recommended maximum length of 100 characters',
      filePath: 'src/very/long/path/to/file.ts',
      fullPath: path.join(baseDir, 'src/very/long/path/to/file.ts'),
      baseDir,
      type: 'warning',
    })
  );
  await prompt(r);

  // Example 5: Error at beginning of file (no line before)
  r.set(
    CodeDebug({
      startLine: 1,
      startColumn: 1,
      errorLine: 'import { something } from "./missing-module";',
      lineAfter: 'export function main() {',
      message: 'Module not found: "./missing-module"',
      filePath: 'src/index.ts',
      fullPath: path.join(baseDir, 'src/index.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 6: Error at end of file (no line after)
  r.set(
    CodeDebug({
      startLine: 99,
      startColumn: 12,
      errorLine: '    return result;',
      lineBefore: '  }',
      message: 'Missing return type annotation',
      filePath: 'src/final.ts',
      fullPath: path.join(baseDir, 'src/final.ts'),
      baseDir,
      type: 'info',
    })
  );
  await prompt(r);

  // Example 7: Single line file (no before or after) - underlining "console.log"
  r.set(
    CodeDebug({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 11,
      errorLine: 'console.log("hello world");',
      message: 'Unexpected console statement in production code',
      filePath: 'script.js',
      fullPath: path.join(baseDir, 'script.js'),
      baseDir,
      type: 'warning',
    })
  );
  await prompt(r);

  // Example 8: Python syntax error
  r.set(
    CodeDebug({
      startLine: 15,
      startColumn: 5,
      errorLine: '    if x > 0:',
      lineBefore: 'def calculate(x):',
      lineAfter: '        return x * 2',
      message: 'SyntaxError: expected an indented block',
      filePath: 'src/calculator.py',
      fullPath: path.join(baseDir, 'src/calculator.py'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 9: Long error message that wraps - underlining "fetchData"
  r.set(
    CodeDebug({
      startLine: 25,
      startColumn: 18,
      endLine: 25,
      endColumn: 27,
      errorLine: '    const data = fetchData();',
      lineBefore: '  async function load() {',
      lineAfter: '    return process(data);',
      message: 'This is a very long error message that will need to wrap to multiple lines because it contains a lot of detailed information about what went wrong and how to fix it. The message should wrap nicely and maintain proper indentation.',
      filePath: 'src/loaders/data.ts',
      fullPath: path.join(baseDir, 'src/loaders/data.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 10: Error with maxColumn constraint - underlining "veryLongFunctionName"
  r.set(
    CodeDebug({
      startLine: 50,
      startColumn: 16,
      endLine: 50,
      endColumn: 35,
      errorLine: 'const result = veryLongFunctionName(withManyParameters, andMoreParameters, thatExtendWayBeyondTheMaxColumn, soWeNeedToTruncate, toMakeRoomForTheMessage)',
      message: 'This error uses maxColumn to ensure there is room for the message',
      filePath: 'src/example.ts',
      fullPath: path.join(baseDir, 'src/example.ts'),
      baseDir,
      type: 'error',
      maxColumn: 100, // Force truncation before column 100
    })
  );
  await prompt(r);

  // Example 11: Large line numbers (999, 1000, 1001) - testing right alignment
  r.set(
    CodeDebug({
      startLine: 1000,
      startColumn: 10,
      endLine: 1000,
      endColumn: 20,
      errorLine: '    const result = calculateValue();',
      lineBefore: '  function process() {',
      lineAfter: '    return result;',
      message: 'Testing large line numbers to ensure proper right alignment',
      filePath: 'src/large-file.ts',
      fullPath: path.join(baseDir, 'src/large-file.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  r.destroy(true);
}

main().catch(console.error);


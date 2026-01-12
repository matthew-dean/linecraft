// Demo showing CodeDebug component with various scenarios

import { Region, CodeDebug, prompt } from '../src/index.js';
import * as path from 'path';

async function main() {
  const r = Region({ debugLog: 'debug.log' });
  const baseDir = process.cwd();

  // Example 1: Simple error at start of line with error code
  r.set(
    CodeDebug({
      startLine: 5,
      startColumn: 1,
      errorLine: 'const x = undefined;',
      message: 'Variable is declared but never used',
      errorCode: 'no-unused-vars',
      filePath: 'src/utils/helper.ts',
      fullPath: path.join(baseDir, 'src/utils/helper.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 2: Error with range (underline) and short message - underlining the variable "x + y"
  r.set(
    CodeDebug({
      startLine: 12,
      startColumn: 12,
      endLine: 12,
      endColumn: 16,
      errorLine: '    return x + y + z;', 
      message: 'Type error: cannot add string and number',
      shortMessage: 'string + number',
      filePath: 'src/math/calculator.ts',
      fullPath: path.join(baseDir, 'src/math/calculator.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 3: Warning with error code and short message
  r.set(
    CodeDebug({
      startLine: 8,
      startColumn: 5,
      errorLine: '    if (condition) {',
      lineBefore: '  function processData() {',
      lineAfter: '      doSomething();',
      message: 'Consider using early return pattern for better readability',
      errorCode: 'eslint(no-else-return)',
      shortMessage: 'use early return',
      filePath: 'src/processors/data.ts',
      fullPath: path.join(baseDir, 'src/processors/data.ts'),
      baseDir,
      type: 'warning',
    })
  );
  await prompt(r);

  // Example 4: Long line that needs truncation with error code - underlining "andEvenMoreParameters"
  r.set(
    CodeDebug({
      startLine: 42,
      startColumn: 80,
      endLine: 42,
      endColumn: 100,
      errorLine: 'const veryLongVariableName = someVeryLongFunctionCall(withManyParameters, andMoreParameters, andEvenMoreParameters, thatMakeThisLineExtremelyLong, soLongThatItNeedsTruncation)',
      message: 'Line exceeds recommended maximum length of 100 characters',
      errorCode: 'max-len',
      shortMessage: 'line too long',
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

  // Example 7: Single line file with error code and short message - underlining "console.log"
  r.set(
    CodeDebug({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 11,
      errorLine: 'console.log("hello world");',
      message: 'Unexpected console statement in production code',
      errorCode: 'no-console',
      shortMessage: 'remove console',
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
      message: 'This is a very long error message that will need to wrap to multiple lines because it contains a lot of detailed information about what went wrong and how to fix it. The message should wrap nicely and maintain proper indentation so that it looks good in the terminal.',
      errorCode: 'typescript(2345)',
      shortMessage: 'async function call',
      filePath: 'src/loaders/data.ts',
      fullPath: path.join(baseDir, 'src/loaders/data.ts'),
      baseDir,
      type: 'error',
    })
  );
  await prompt(r);

  // Example 10: Error with maxColumn constraint and wrapped message - underlining "veryLongFunctionName"
  r.set(
    CodeDebug({
      startLine: 50,
      startColumn: 16,
      endLine: 50,
      endColumn: 35,
      errorLine: 'const result = veryLongFunctionName(withManyParameters, andMoreParameters, thatExtendWayBeyondTheMaxColumn, soWeNeedToTruncate, toMakeRoomForTheMessage)',
      message: 'This error uses maxColumn to ensure there is room for the message. The message itself is also quite long and should wrap nicely across multiple lines to demonstrate the wrapping functionality of the top message area.',
      errorCode: 'eslint-plugin-unicorn(no-useless-length-check)',
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

  // Example 12: Multi-line warning message with newlines (testing word-wrapping with line-breaks)
  // This simulates a diagnostic message format like "CODE [phase]\nMessage\n\nReason: ...\nFix: ..."
  r.set(
    CodeDebug({
      startLine: 77,
      startColumn: 77,
      endColumn: 78,
      errorLine: '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};',
      lineBefore: '@media (tv) {',
      lineAfter: '    color: black;',
      errorCode: 'JESS3203 [extend]',
      message: `Extend target ".v" not accessible

Reason: ".v" exists but is not accessible from the current extend root (blocked by at-rule or compose boundary).
Fix: Move the extend or the target to a shared extend root, or use a different approach.`,
      filePath: '../less.js/packages/test-data/tests-unit/extend-chaining/extend-chaining.less',
      fullPath: path.join(baseDir, '../less.js/packages/test-data/tests-unit/extend-chaining/extend-chaining.less'),
      baseDir,
      type: 'warning',
    })
  );
  await prompt(r);

  r.destroy(true);
}

main().catch(console.error);


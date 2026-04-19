'use strict';
const vm = require('node:vm');

const MAX_FRAMES = 500;
const TIMEOUT_MS = 5000;
const _frames = [];
let _step = 0;
const _callStack = [{ funcName: '<module>', line: 0 }];
const _capturedStdout = [];
const _capturedStderr = [];
let _userError = null;
let _done = false;

// Decode user code from base64
const _userCode = Buffer.from('__BASE64_CODE__', 'base64').toString('utf-8');
const _userLines = _userCode.split('\n');
const _totalLines = _userLines.length;

// Instrument the user code: prepend _t(lineNum) before each non-empty line
// Also convert let/const to var so variables are accessible on the sandbox context.
// Replacement is done line-by-line to avoid corrupting string literals.
function _instrumentCode(code) {
  const lines = code.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Skip empty lines and lines that are just comments
    if (trimmed === '' || trimmed.startsWith('//')) {
      result.push(line);
      continue;
    }
    // Skip lines that are just closing braces/brackets
    if (trimmed === '}' || trimmed === '};' || trimmed === ']' || trimmed === '];') {
      result.push(line);
      continue;
    }
    // Convert let/const to var only at the start of a statement (not inside strings)
    // Match let/const followed by whitespace at the beginning of the trimmed line
    const transformed = line.replace(/^(\s*)(let|const)(\s+)/, '$1var$3');
    // Prepend trace call before each executable line
    result.push('_t(' + (i + 1) + '); ' + transformed);
  }
  return result.join('\n');
}

// Stringify a value for trace output (like Python repr)
function _repr(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'function') return 'function ' + (val.name || 'anonymous') + '()';
  try {
    return JSON.stringify(val);
  } catch (error_) {
    _capturedStderr.push('Trace stringify failed: ' + String(error_ && error_.message ? error_.message : error_));
    return String(val);
  }
}

// Build the sandbox context
const _sandbox = {
  console: {
    log: function() {
      const args = Array.prototype.slice.call(arguments);
      _capturedStdout.push(args.map(String).join(' '));
    },
    error: function() {
      const args = Array.prototype.slice.call(arguments);
      _capturedStderr.push(args.map(String).join(' '));
    },
    warn: function() {
      const args = Array.prototype.slice.call(arguments);
      _capturedStderr.push(args.map(String).join(' '));
    },
    info: function() {
      const args = Array.prototype.slice.call(arguments);
      _capturedStdout.push(args.map(String).join(' '));
    }
  },
  parseInt: Number.parseInt,
  parseFloat: Number.parseFloat,
  isNaN: Number.isNaN,
  isFinite: Number.isFinite,
  Math: Math,
  Date: Date,
  JSON: JSON,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  RangeError: RangeError,
  SyntaxError: SyntaxError,
  ReferenceError: ReferenceError,
  Promise: Promise,
  Map: Map,
  Set: Set,
  WeakMap: WeakMap,
  WeakSet: WeakSet,
  Symbol: Symbol,
  undefined: undefined,
  NaN: Number.NaN,
  Infinity: Infinity,
  _t: null // will be set below
};

// Set of keys that are sandbox infrastructure (not user variables)
const _builtinKeys = new Set(Object.keys(_sandbox));
_builtinKeys.add('_t');

// Trace function — called before each user line
_sandbox._t = function(lineNum) {
  if (_done || _step >= MAX_FRAMES) {
    _done = true;
    return;
  }
  _step++;

  // Collect locals from sandbox (only user-defined variables)
  const locals = {};
  const keys = Object.keys(_sandbox);
  for (const k of keys) {
    if (_builtinKeys.has(k)) continue;
    try {
      locals[k] = _repr(_sandbox[k]);
    } catch (error_) {
      _capturedStderr.push('Trace locals capture failed for ' + k + ': ' + String(error_ && error_.message ? error_.message : error_));
      locals[k] = '<error>';
    }
  }

  // Build stack (single frame for top-level code)
  const stack = [];
  for (const sf of _callStack) {
    stack.push({
      funcName: sf.funcName,
      line: lineNum,
      locals: locals
    });
  }

  _frames.push({
    step: _step,
    line: lineNum,
    event: 'line',
    funcName: _callStack[_callStack.length - 1].funcName,
    locals: locals,
    stack: stack,
    returnValue: null,
    exception: null
  });
};

// Instrument and execute
try {
  const _instrumented = _instrumentCode(_userCode);
  vm.runInNewContext(_instrumented, _sandbox, {
    filename: 'user_code.js',
    timeout: TIMEOUT_MS
  });
} catch (error_) {
  _capturedStderr.push('Execution failed: ' + String(error_ && error_.message ? error_.message : error_));
  if (error_ && error_.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
    _userError = { type: 'TimeoutError', message: 'Execution timed out (5s limit)' };
  } else {
    _userError = { type: (error_ && error_.constructor && error_.constructor.name) || 'Error', message: String(error_ && error_.message || error_) };
  }
}

// Capture final variable state if we have frames
if (_frames.length > 0 && !_done) {
  const finalLocals = {};
  const fkeys = Object.keys(_sandbox);
  for (const fk of fkeys) {
    if (_builtinKeys.has(fk)) continue;
    try {
      finalLocals[fk] = _repr(_sandbox[fk]);
    } catch (error_) {
      _capturedStderr.push('Final locals capture failed for ' + fk + ': ' + String(error_ && error_.message ? error_.message : error_));
      finalLocals[fk] = '<error>';
    }
  }
  // Update the last frame's locals to reflect final state
  _frames[_frames.length - 1].locals = finalLocals;
  const lastStack = _frames[_frames.length - 1].stack;
  if (lastStack.length > 0) {
    lastStack[lastStack.length - 1].locals = finalLocals;
  }
}

// Output trace
const _output = {
  frames: _frames,
  stdout: _capturedStdout.join('\n'),
  stderr: _capturedStderr.join('\n'),
  error: _userError
};

process.stdout.write('---TRACE_START---\n');
process.stdout.write(JSON.stringify(_output));
process.stdout.write('\n---TRACE_END---\n');

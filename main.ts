import fs from 'node:fs';
import path from 'node:path';

// Tiny stack VM (make.fun tiny-stack-vm-01). The rule is ISA.md + vm.mjs in the kit:
// 32-bit wrapping ints, 256-value data stack, 64 return addresses, 256 words of
// memory, input/output, ten traps with their own exit codes, 1,000,000 steps,
// 65,536 output bytes. One run answers every instance under the input dir.
const STEP_MAX = 1000000;
const OUT_MAX = 65536;
const DIG = new Uint8Array(12); // scratch for PRINT's decimal digits

// [opcode, immediate bytes, pops, pushes] for every opcode, packed one byte each.
const META = new Uint8Array(256);
for (const [o, im, po, pu] of [
  [0x00, 0, 0, 0], [0x01, 1, 0, 1], [0x02, 4, 0, 1], [0x03, 0, 1, 0],
  [0x04, 0, 1, 2], [0x05, 0, 2, 2], [0x06, 0, 2, 3], [0x07, 0, 3, 3],
  [0x10, 0, 2, 1], [0x11, 0, 2, 1], [0x12, 0, 2, 1], [0x13, 0, 2, 1],
  [0x14, 0, 2, 1], [0x15, 0, 2, 1], [0x16, 0, 2, 1], [0x17, 0, 1, 1],
  [0x18, 0, 2, 1], [0x19, 0, 2, 1], [0x1a, 0, 2, 1], [0x1b, 0, 1, 1],
  [0x1c, 0, 2, 1], [0x1d, 0, 2, 1], [0x1e, 0, 2, 1],
  [0x20, 0, 2, 1], [0x21, 0, 2, 1], [0x22, 0, 2, 1],
  [0x30, 2, 0, 0], [0x31, 2, 1, 0], [0x32, 2, 1, 0], [0x33, 2, 0, 0], [0x34, 0, 0, 0],
  [0x40, 0, 1, 1], [0x41, 0, 2, 0],
  [0x50, 0, 1, 0], [0x51, 0, 1, 0], [0x52, 0, 0, 1], [0x53, 0, 1, 0],
]) META[o] = 1 + im + (po << 3) + (pu << 6);

function run(prog, input) {
  const d = new Int32Array(256); // data stack
  const cs = new Int32Array(64); // call stack
  const mem = new Int32Array(256); // memory
  const out = new Uint8Array(OUT_MAX);
  let sp = 0, cp = 0, pc = 0, ip = 0, ol = 0, steps = 0;
  const n = prog.length;
  for (;;) {
    if (steps === STEP_MAX) return [out, ol, 10];
    if (pc < 0 || pc >= n) return [out, ol, 9];
    const op = prog[pc];
    const z = META[op];
    if (z === 0) return [out, ol, 5];
    const v = z - 1, im = v & 7, po = (v >> 3) & 7, pu = v >> 6;
    if (pc + im >= n) return [out, ol, 9];
    if (sp < po) return [out, ol, 2];
    if (sp - po + pu > 256) return [out, ol, 3];
    steps++;
    const nx = pc + 1 + im;
    pc = nx;
    switch (op) {
      case 0x00: return [out, ol, 0];
      case 0x01: d[sp++] = (prog[nx - 1] << 24) >> 24; break;
      case 0x02: d[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: d[sp] = d[sp - 1]; sp++; break;
      case 0x05: { const t = d[sp - 1]; d[sp - 1] = d[sp - 2]; d[sp - 2] = t; break; }
      case 0x06: d[sp] = d[sp - 2]; sp++; break;
      case 0x07: { const a = d[sp - 3]; d[sp - 3] = d[sp - 2]; d[sp - 2] = d[sp - 1]; d[sp - 1] = a; break; }
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = d[--sp], a = d[--sp];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (b === 0) return [out, ol, 4]; r = (a / b) | 0; }
        else if (op === 0x14) { if (b === 0) return [out, ol, 4]; r = (a % b) | 0; }
        else if (op === 0x15) { if (b === 0) return [out, ol, 4]; r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (b === 0) return [out, ol, 4]; r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        d[sp++] = r;
        break;
      }
      case 0x17: d[sp - 1] = (-d[sp - 1]) | 0; break;
      case 0x1b: d[sp - 1] = ~d[sp - 1]; break;
      case 0x30: pc = nx + (((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16); break;
      case 0x31: case 0x32: {
        const t = d[--sp];
        if ((op === 0x31) === (t === 0)) pc = nx + (((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16);
        break;
      }
      case 0x33:
        if (cp === 64) return [out, ol, 7];
        cs[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return [out, ol, 8];
        pc = cs[--cp];
        break;
      case 0x40: {
        const a = d[sp - 1];
        if (a < 0 || a > 255) return [out, ol, 6];
        d[sp - 1] = mem[a];
        break;
      }
      case 0x41: {
        const a = d[--sp], vv = d[--sp];
        if (a < 0 || a > 255) return [out, ol, 6];
        mem[a] = vv;
        break;
      }
      case 0x50: {
        const t = d[--sp];
        let u = t < 0 ? -t : t, j = 12;
        do { DIG[--j] = 48 + (u % 10); u = Math.floor(u / 10); } while (u > 0);
        if (t < 0) DIG[--j] = 45;
        if (ol + (12 - j) > OUT_MAX) return [out, ol, 11];
        out.set(DIG.subarray(j), ol); ol += 12 - j;
        break;
      }
      case 0x51: {
        const t = d[--sp];
        if (ol >= OUT_MAX) return [out, ol, 11];
        out[ol++] = t & 255;
        break;
      }
      case 0x52: d[sp++] = ip < input.length ? input[ip++] : -1; break;
      case 0x53: return [out, ol, d[--sp] & 255];
    }
  }
}

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
fs.mkdirSync(OUT, { recursive: true });
for (const id of fs.readdirSync(IN).sort()) {
  const dir = path.join(IN, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  let prog;
  try { prog = fs.readFileSync(path.join(dir, 'program.bin')); } catch { continue; }
  let input;
  try { input = fs.readFileSync(path.join(dir, 'input.bin')); } catch { input = Buffer.alloc(0); }
  const [o, n, code] = run(prog, input);
  const od = path.join(OUT, id);
  fs.mkdirSync(od, { recursive: true });
  fs.writeFileSync(path.join(od, 'stdout.bin'), o.subarray(0, n));
  fs.writeFileSync(path.join(od, 'exit.txt'), code + '\n');
}

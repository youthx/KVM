/*
The KTRO Virtual Machine 
This machine can compile KTRO Packages to run with JS.

* PROJECT WILL BE FINISHED & READY IN 2024

* Todo:
  - Add support for signed numbers
  - Add support for 32 and 64 bit ints,
  - Add support for 32 and 64 bit floats,
  - Add a data section
  - Ability to call standard library functions
  - Jumps and functions
  - Entry function
  - Support some Javascript libs like WebGL, Express, etc

As of now, only use bin type 0xA1 as its the only supported bin type.
*/

import { executionAsyncResource } from "async_hooks";
import * as fs from "fs";
import blessed from "blessed";
const termgl = blessed;

export const PackageProgram = (output, program) => {
  return fs.writeFileSync(output, Buffer.from(program));
};

export const FromPackage = (p) => {
  return Uint8Array.from(fs.readFileSync(p));
};

export const chr = (c) => c.charCodeAt(0);

export const VirtualMemoryBuffer = (sizeInBytes) => {
  const ab = new ArrayBuffer(sizeInBytes);
  const dv = new DataView(ab);
  return dv;
};

export const imm16 = (word) => [(word >> 8) & 0xff, word & 0xff];

export const SECTION = 0xfa;

export const STEP_DEBUGGER = 0x0a;
export const BRANCH_DEBUGGER = 0x1a;
export const INST_DEBUGGER = 0x2a;

export const NOP = 0x00;
export const BINARY = 0x01;
export const INTERRUPT = 0x02;
export const META = 0x03;
export const DB = 0x04;
export const ERASE = 0x05;
export const FUNC = 0x06;
export const LABEL = 0x07;
export const CONST = 0x10;
export const ADD = 0x11;
export const HLT = 0x12;
export const CMPEQ = 0x13;
export const CMPNE = 0x14;
export const CMPGT = 0x15;
export const CMPLT = 0x16;
export const CMPGE = 0x17;
export const CMPLE = 0x18;
export const ASCIZ = 0x19;
export const EXTERN = 0x20;

export const STO = 0x0a;
export const LDS = 0x1a;
export const POPL = 0x2a;
export const DEL = 0x3a;
export const STSRZ = 0x4a;
export const LLSRZ = 0x5a;
export const LDR = 0x6a;
export const LDAZ = 0x7a;
export const HLTS = 0x8a;
export const HLTF = 0x9a;
export const SUB = 0xaa;
export const MUL = 0xba;
export const DIV = 0xca;
export const FLR = 0xda;

export const CEIL = 0xea;
export const RDIV = 0xfa;
export const INC = 0x0b;
export const DEC = 0x1b;
export const MOD = 0x2b;
export const POW = 0x3b;
export const SQRT = 0x4b;
export const JMP = 0x5b;
export const JE = 0x6b;
export const JNE = 0x7b;
export const JZE = 0x8b;
export const CZF = 0x9b;
export const CAF = 0xab;
export const OFFSET = 0xbb;
export const JPR = 0xcb;
export const JER = 0xdb;
export const JNR = 0xec;
export const JZR = 0xfc;
export const JERA = 0x0c;
export const JNRA = 0x1c;
export const JZRA = 0x2c;
export const CALL = 0x4c;
export const RET = 0x5c;

export const U8 = 8;
export const U16 = 16;
export const U32 = 32;
export const VOID = 0;

export const SYSINT = {
  EXIT: 0,
  WRITE: 1,
  READ: 2,
};

export class KtroPreproccessor {
  constructor(buffer, mem_start) {
    this.program = buffer;
    this.program_length = buffer.length;
    this.address_offset = mem_start;

    this.pointer = -1;
    this.current = null;
    this.current_address = mem_start;

    this.functions = [];
    this.labels = [];
    this.sections = [];
    this.metadata = [];
    this.bintype = 0;
    this.finished = false;
    this.result = 0;
    this.entry_func = 0;
    this.entry_declared = false;
    this.current_section;
  }

  back() {
    if (this.pointer <= 0) {
      return this.current;
    }

    this.pointer -= 1;
    this.current_address = this.pointer + this.address_offset;
    this.current = this.program[this.pointer];
    return this.current;
  }

  next() {
    if (this.pointer >= this.program_length) {
      this.finish(0);
      return 0x00;
    }

    this.pointer += 1;
    this.current_address = this.pointer + this.address_offset;
    this.current = this.program[this.pointer];
    return this.current;
  }

  finish(exitcode) {
    this.finished = true;
    this.result = exitcode;
  }

  error(msg) {
    console.error(`preproccessor error: ${msg} (at ${this.pointer})`);
    this.finish(1);
  }

  section() {
    const magic_num = this.next();
    if (magic_num === SECTION) {
      this.current_section = this.next();
    }
  }
  function() {
    const id = this.next();
    let func = {
      address: this.current_address + 1,
      id: id,
    };
    // console.log(`addr: ${this.current_address - (0xFFF + 1)}\nval: ${this.current}`);
    this.functions.push(func);
  }

  label() {
    const id = this.next();
    let label = {
      address: this.current_address + 1,
      id: id,
    };
    this.labels.push(label);
  }

  binary() {
    if (this.bintype) return;
    const type = this.next();
    this.bintype = type;
    return;
  }

  meta() {
    const data = this.next();
    this.metadata.push(data);
    return;
  }

  preproccess() {
    while (!this.finished) {
      if (this.current_section === 0) {
        switch (this.current) {
          case BINARY:
            this.binary();
            break;
          case META:
            this.meta();
            break;
          case SECTION:
            this.section();
            break;
          default:
            this.next();
        }
      } else if (this.current_section === 1) {
        switch (this.current) {
          case FUNC:
            this.function();
            break;
          case LABEL:
            this.label();
            break;
          default:
            this.next();
        }
      } else {
        let n = this.next();
        if (n === SECTION) {
          if (this.next() === SECTION) {
            this.current_section = this.next();
          }
        }
      }
    }
    return this.result;
  }
}

export class KtroVirtualMachine {
  constructor(memory, buffer) {
    /*
    BIN TYPES
    0xA1 = INLINE PROGRAM
    0xA2 = INLINE ENTRY
    0xF1 = PACKAGE
    0xF2 = PACKAGE NO ENTRY
    */
    /*
    META TYPES
    0x00 = NO METADATA
    0x1F = FCR (Flag Compare Results) 
          | Instead of pushing the truthy value to the stack,
          | It sets the Zero Flag instead.
    */
    this.memory = memory;

    this.MEMORY_START = 0xfff + 1;
    this.MEMORY_END = this.memory.length;
    this.HEAP_START = this.MEMORY_START + buffer.length;
    this.HEAP_MAX = this.memory.length - (0xfff + 1);
    this.STACK_BASE = 0xfff;

    this.MAX_ITERATIONS = buffer.length * 10;
    this.step_debug = false;
    this.branch_debug = false;
    this.inst_debug = false;

    this.USE_FLAGS = false;
    this.ZERO_FLAG = false;
    this.NEG_FLAG = false;

    this.STDOUT = 0;
    this.STDIN = 1;

    this.registerNames = [
      "rtp",
      "rsp",
      "rip",
      "rhp",
      "r10",
      "r9",
      "r8",
      "r7",
      "r6",
      "r5",
      "r4",
      "r3",
      "r2",
      "r1",
    ];

    this.registers = VirtualMemoryBuffer(this.registerNames.length * 2);

    this.program = buffer;
    this.program_len = buffer.length;

    this.registerMap = this.registerNames.reduce((map, name, i) => {
      map[name] = i * 2;
      return map;
    }, {});

    this.setRegister("rhp", this.HEAP_START);
    this.setRegister("rip", this.MEMORY_START);
    this.setRegister("rsp", this.STACK_BASE);
    this.setRegister("rtp", 0x0);

    this.preproccesor = new KtroPreproccessor(buffer, this.MEMORY_START);
    this.preprocess_result = this.preproccesor.preproccess();
    if (this.preprocess_result != 0) {
      console.error("kvm: execution failed");
      return this.preprocess_result;
    }

    this.functions = this.preproccesor.functions;
    this.labels = this.preproccesor.labels;
    this.func_entry = 0;
    this.bin_type = this.preproccesor.bintype;
    this.externs = [];
    this.setBinaryType(this.preproccesor.bintype);

    this.preproccesor.metadata.forEach((meta) => {
      this.addMetaData(meta);
    });
    this.steps = 0;

    for (let i = 0; i < buffer.length; i++) {
      this.memory.setUint8(i + this.MEMORY_START, buffer[i]);
      //console.log(buffer[i]);
    }

    this.current_function = null;

    this.halt = false;
    this.exit_code = 0;
    this.current_step = 0;
    this.pause_execution = false;
    this.saved_rip = this.MEMORY_START;
  }

  addNamespace({ namespaceID, jsFunctions }) {
    let id = 0;
    jsFunctions.forEach((f) => {
      id += 1;
      this.addExtern({
        namespaceID: namespaceID,
        methodID: id,
        jsFunction: f,
      });
    });
  }

  addExtern({ namespaceID, methodID, jsFunction }) {
    this.externs.push({
      namespaceID: namespaceID,
      methodID: methodID,
      jsFunction: jsFunction,
    });
  }

  getRegisterByNumber(r) {
    return this.getRegister(`r${r}`);
  }

  setBinaryType(type) {
    this.bin_type = type;
    return;
  }

  addMetaData(code) {
    switch (code) {
      case 0x00:
        return;
      case 0x1f: {
        this.USE_FLAGS = true;
        return;
      }
    }
    return;
  }

  storeStringToHeap(offset, str) {
    for (let i = 0; i < str.length; i++) {
      let byte = str.charCodeAt(i);
      this.heapStoreImm8(this.offsetAsHeapAddress(offset + i), byte);
    }
  }

  runExternalFunction(namespace, id) {
    for (let i = 0; i < this.externs.length; i++) {
      let ext = this.externs[i];
      if (ext.namespaceID == namespace && ext.methodID == id) {
        let result = ext.jsFunction(this);
        if (result) this.push(result[1], result[0]);
        return 200;
      }
    }
    return null;
  }

  resultValue(value, type) {
    return [value, type];
  }

  getArgument(type) {
    return this.pop(type);
  }

  useDebugger(_debugger) {
    switch (_debugger) {
      case STEP_DEBUGGER:
        this.step_debug = true;
        return;
      case BRANCH_DEBUGGER:
        this.branch_debug = true;
        return;
      case INST_DEBUGGER:
        this.inst_debug = true;
        break;
    }
    return;
  }

  debug() {
    if (this.branch_debug) {
      console.log(
        `step (${this.current_step + 1}) | instruction ptr: ${this.getRegister(
          "rip",
        )}`,
      );
      return;
    }
    if (this.step_debug) {
      console.log(`step: ${this.current_step + 1}`);
      console.log(`stack ptr: ${this.getRegister("rsp")}`);
      console.log(
        `flags (${this.USE_FLAGS ? "y" : "n"}): |Z: ${this.ZERO_FLAG}|`,
      );
      console.log("stack snapshot:");
      for (let i = this.STACK_BASE; i >= 0; i--) {
        let value = this.memory.getUint8(i);
        console.log(`${i}: ${value}`);
        if (value == 0) break;
      }
      console.log("");
      return;
    }
  }

  lastResultTruthy() {
    if (this.USE_FLAGS) {
      return this.ZERO_FLAG === 1;
    }
    return this.pop(8) === 1;
  }

  compareResult(res) {
    if (this.USE_FLAGS) {
      this.ZERO_FLAG = res ? 1 : 0;
      return;
    }
    this.push(8, res);
  }

  offsetAsHeapAddress(offset) {
    const addr = this.HEAP_START + offset;
    return addr >= this.HEAP_MAX ? this.HEAP_MAX : addr;
  }

  getFunction(id) {
    for (let i = 0; i < this.functions.length; i++) {
      if (this.functions[i].id === id) {
        return this.functions[i];
      }
    }
    return null;
  }

  getLabel(id) {
    for (let i = 0; i < this.labels.length; i++) {
      if (this.labels[i].id === id) {
        return this.labels[i];
      }
    }
    return null;
  }

  getBitSize(n) {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
  }

  getRegister(name) {
    if (!(name in this.registerMap)) {
      throw new Error(`getRegister: no such register '${name}'`);
    }
    return this.registers.getUint16(this.registerMap[name]);
  }

  setRegister(name, value) {
    if (!(name in this.registerMap)) {
      throw new Error(`setRegister: no such register '${name}'`);
    }
    return this.registers.setUint16(this.registerMap[name], value);
  }

  heapStoreAuto(size, offset, value) {
    switch (size) {
      case 8:
        return this.heapStoreImm8(offset, value);
      case 16:
        return this.heapStoreImm16(offset, value);
    }
    console.error(`heapStoreAuto: invalid size ${size}`);
    return;
  }

  heapLoadAuto(size, addr) {
    switch (size) {
      case 8:
        return this.heapLoad8(addr);
      case 16:
        return this.heapLoad16(addr);
    }
    console.error(`heapLoadAuto: invalid size ${size}`);
    return;
  }

  heapStoreImm16(addr, value) {
    this.setRegister("rhp", addr + 1);
    this.memory.setUint16(addr, value);
  }

  heapStoreImm8(addr, value) {
    this.setRegister("rhp", addr);
    this.memory.setUint8(addr, value);
  }

  heapLoad16(addr) {
    return this.memory.getUint16(addr);
  }

  heapLoad8(addr) {
    return this.memory.getUint8(addr);
  }

  fetch() {
    const nextInstructionAddress = this.getRegister("rip");
    const instruction = this.memory.getUint8(nextInstructionAddress);
    this.setRegister("rip", nextInstructionAddress + 1);
    return instruction;
  }

  fetch16() {
    const nextInstructionAddress = this.getRegister("rip");
    const instruction = this.memory.getUint16(nextInstructionAddress);
    this.setRegister("rip", nextInstructionAddress + 2);
    return instruction;
  }

  fetch32() {
    const nextInstructionAddress = this.getRegister("rip");
    const instruction = this.memory.getUint32(nextInstructionAddress);
    this.setRegister("rip", nextInstructionAddress + 4);
    return instruction;
  }

  fetchBySize(size) {
    switch (size) {
      case 8:
        return this.fetch();
      case 16:
        return this.fetch16();
      case 32:
        return this.fetch32();
    }
    console.error(`fetchBySize: invalid size ${size}`);
    return;
  }

  loadBufferFromHeap(offset) {
    const addr = this.offsetAsHeapAddress(offset);
    let text = "";
    for (let i = 0; true; i++) {
      let b = this.heapLoad8(addr + i);
      if (b === 0) break;
      text += String.fromCharCode(b);
    }
    return text;
  }

  /*
  File mode format: 0b000
   0     0     0
  w|r|  b|!b  x|!x
  w = write 1
  r = read 0
  b = bytes 1
  !b = no bytes 0
  x = extend 1
  !x = overwrite 0
  */
  getStrFileMode(mode) {
    // Extracting bits
    const m = (mode & 0b100) >> 2; // M
    const b = (mode & 0b010) >> 1; // B
    const x = mode & 0b001; // X
    let res = (m === 1) ? "w" : "r";
    res += (b === 1) ? "b" : "";
    res += (x === 1) ? "+" : "";
    return res;
  }
  
  interrupt() {
    const code = this.fetch();
    switch (code) {
      case 1: {
        const stream = this.fetch();
        let fp = "";
        if (stream > 0) {
          fp = this.loadBufferFromHeap(stream);
        } 
        const offset = this.fetch();
        let text = this.loadBufferFromHeap(offset);
        if (fp == "") process.stdout.write(text);
        else {
          fs.writeFileSync(fp,text);
        }
        
        return;
      }
    }
  }

  push(size, value) {
    let topOfStack = this.getRegister("rsp") - size / 8;
    switch (size) {
      case 8:
        this.memory.setUint8(topOfStack, value);
        break;
      case 16:
        this.memory.setUint16(topOfStack, value);
        break;
      case 32:
        this.memory.setUint32(topOfStack, value);
        break;
      default:
        console.error(`push: invalid size '${size}' (value ${value})`);
    }
    if (value < 0) {
      if (this.USE_FLAGS) this.NEG_FLAG = true;
      else {
        topOfStack -= 1;
        this.memory.setUint8(topOfStack, value);
      }
    }
    this.setRegister("rsp", topOfStack);
    return;
  }

  pop(size) {
    let topOfStack = this.getRegister("rsp");
    if (topOfStack >= this.STACK_BASE) {
      this.setRegister("rsp", this.STACK_BASE);
      topOfStack = this.getRegister("rsp");
    }
    var value;
    switch (size) {
      case 8: {
        value = this.memory.getUint8(topOfStack);
        this.memory.setUint8(topOfStack, 0);
        break;
      }
      case 16: {
        value = this.memory.getUint16(topOfStack);
        this.memory.setUint16(topOfStack, 0);
        break;
      }
      case 32: {
        value = this.memory.getUint32(topOfStack);
        this.memory.setUint32(topOfStack, 0);
        break;
      }
      default:
        console.error(`pop (retrieve): invalid size '${size}'`);
    }
    this.setRegister("rsp", topOfStack + size / 8);
    return value;
  }

  error(msg) {
    console.error(`kvm: ${msg}`);
    this.exit_code = 1;
    this.halt = true;
    return;
  }

  segfault() {
    console.error("kvm: segmentation fault (1)");
    this.exit_code = 1;
    this.halt = true;
    return;
  }

  execute(instruction) {
    switch (instruction) {
      case NOP: {
        return;
      }

      case EXTERN: {
        const namespace = this.fetch();
        const id = this.fetch();
        const func = this.runExternalFunction(namespace, id);
        if (func == null) {
          this.error(`cannot find external function ${namespace}.${id}`);
        }
        return;
      }

      case CALL: {
        const id = this.fetch();
        const func = this.getFunction(id);
        if (func == null) {
          this.error(`cannot find function ${id}`);
          return;
        }
        this.saved_rip = this.getRegister("rip");
        this.setRegister("rip", func.address);
        return;
      }

      case RET: {
        this.setRegister("rip", this.saved_rip);
        return;
      }

      case CZF: {
        this.ZERO_FLAG = 0;
        return;
      }

      case CAF: {
        this.ZERO_FLAG = 0;
        return;
      }

      case JMP: {
        const addr = this.getLabel(this.fetch());
        this.setRegister("rip", addr.address);
        return;
      }

      case JZE: {
        const addr = this.getLabel(this.fetch());
        if (this.lastResultTruthy()) {
          this.setRegister("rip", addr.address);
        }
        return;
      }

      case CONST: {
        const size = this.fetch();
        const value = this.fetchBySize(size);

        this.push(size, value);
        return;
      }

      case POPL: {
        const size = this.fetch();
        this.pop(size);
        return;
      }

      case STO: {
        const size = this.fetch();
        const offset = this.fetch();
        const address = this.offsetAsHeapAddress(offset);
        const value = this.pop(size);
        this.heapStoreAuto(size, address, value);
        return;
      }

      case DB: {
        const size = this.fetch();
        this.hoffset += size;
      }

      case ERASE: {
        const offset = this.fetch();
        const size = this.fetch();
        for (let i = 0; i < size; i++) {
          const address = this.offsetAsHeapAddress(offset + i);
          this.heapStoreAuto(U8, address, 0);
        }
        return;
      }

      case LDS: {
        const size = this.fetch();
        const offset = this.fetch();
        const address = this.offsetAsHeapAddress(offset);
        const value = this.heapLoadAuto(size, address);
        this.push(size, value);
        return;
      }

      case DEL: {
        const size = this.fetch();
        const offset = this.fetch();
        const address = this.offsetAsHeapAddress(offset);
        this.heapStoreAuto(size, address, 0);
        return;
      }

      case HLT: {
        const size = this.fetch();
        const exit_code = this.pop(size);
        this.exit_code = exit_code;
        this.halt = true;
        return;
      }

      case ADD: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const sum = left + right;
        this.push(size, sum);
        return;
      }

      case SUB: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const sum = right - left;
        this.push(size, sum);
        return;
      }

      case MUL: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const sum = left * right;
        this.push(size, sum);
        return;
      }

      case CMPEQ: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const res = left === right;
        this.compareResult(res);
        return;
      }

      case CMPNE: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const res = left !== right;
        this.compareResult(res);
        return;
      }

      case ASCIZ: {
        for (; true; ) {
          let byte = this.fetch();
          if (byte === 0) {
            this.heapStoreImm8(this.hoffset, byte);
            this.hoffset += 1;
            break;
          }
          this.heapStoreImm8(this.hoffset, byte);
          this.hoffset += 1
        }
        return;
      }

      case LDR: {
        const reg = this.fetch();
        const size = this.fetch();
        const value = this.fetchBySize(size);
        this.setRegister(`r${reg}`, value);
        return;
      }

      case OFFSET: {
        const size = this.fetch();
        this.hoffset += size
        return;
      }
      case INTERRUPT: {
        this.interrupt();
        return;
      }
    }
  }

  step() {
    if (this.pause_execution) {
      for (let pc = 0; true; pc++) {
        if (pc === 5000) console.log("program not responding.");
      }
    }
    this.steps += 1;
    const instruction = this.fetch();
    if (this.inst_debug) {
      console.log(
        `[${this.steps}] (inst ${instruction
          .toString(16)
          .padStart(2, "0")}) (rip ${this.getRegister("rip")})`,
      );
    }
    return this.execute(instruction);
  }

  initialize() {
    /*
    BIN TYPES
    0xA1 = INLINE PROGRAM
    0xA2 = INLINE ENTRY
    0xF1 = PACKAGE
    0xF2 = PACKAGE NO ENTRY
    */
    this.hoffset = this.HEAP_START;
    switch (this.bin_type) {
      case 0xa1:
        return;
      case 0xa2: {
        const entry = this.getFunction(0);
        // console.log(entry);

        if (entry == null) {
          this.error("cannot find entry");
          return;
        }
        this.saved_rip = entry.address;
        this.setRegister("rip", entry.address);
        return;
      }
    }
  }

  run() {
    this.initialize();
    var i = 0;
    while (!this.halt) {
      this.step();
      if (this.halt) break;
      if (i >= this.MAX_ITERATIONS) {
        this.segfault();
        return 1;
      }

      this.debug();
      // console.log(`op: ${this.getRegister("rip")-this.MEMORY_START}`);
      this.current_step += 1;
      i += 1;
    }
    if (this.step_debug) {
      console.log("\nHEAP SUMMARY:");
      for (let i = this.HEAP_START; i <= this.getRegister("rhp") + 5; i++) {
        console.log(`${i}: ${this.memory.getUint8(i)}`);
      }
      console.log("");
    }
    return this.exit_code;
  }
}

export const KtroInstance = (memory, buffer) => {
  return new KtroVirtualMachine(memory, buffer);
};

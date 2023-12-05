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

const fs = require('fs');

const PackageProgram = (output, program) => {
  return fs.writeFileSync(output, Buffer.from(program));
}


const FromPackage = (package) => {
  return Uint8Array.from(fs.readFileSync(package));
}

const VirtualMemoryBuffer = sizeInBytes => {
  const ab = new ArrayBuffer(sizeInBytes);
  const dv = new DataView(ab);
  return dv;
};

const STEP_DEBUGGER = 0x0A;
const BRANCH_DEBUGGER = 0x1A;


const NOP = 0x00;
const BINARY = 0x01;
const INTERRUPT = 0x02;
const META = 0x03;

const CONST = 0x10;
const ADD = 0x11;
const HLT = 0x12;
const CMPEQ = 0x13;
const CMPNE = 0x14;
const CMPGT = 0x15;
const CMPLT = 0x16;
const CMPGE = 0x17;
const CMPLE = 0x18;
const CMAEQ = 0x19;
const CMANE = 0x20;

const STO = 0x0A;
const LDS = 0x1A;
const POPL = 0x2A;
const DEL = 0x3A;
const STSRZ = 0x4A;
const LLSRZ = 0x5A;
const LDA = 0x6A;
const LDAZ = 0x7A;
const HLTS = 0x8A;
const HLTF = 0x9A;
const SUB = 0xAA;
const MUL = 0xBA;
const DIV = 0xCA;
const FLR = 0xDA;

const CEIL = 0xEA;
const RDIV = 0xFA;
const INC = 0x0B;
const DEC = 0x1B;
const MOD = 0x2B;
const POW = 0x3B;
const SQRT = 0x4B;
const JMP = 0x5B;
const JE = 0x6B;
const JNE = 0x7B;
const JZE = 0x8B;
const CZF = 0x9B;
const CAF = 0xAB;
const JPRA = 0xBB;
const JPR = 0xCB;
const JER = 0xDB;
const JNR = 0xEC;
const JZR = 0xFC;
const JERA = 0x0C;
const JNRA = 0x1C;
const JZRA = 0x2C;


const U8 = 8;
const U16 = 16;
const U32 = 32;

class KtroVirtualMachine {
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
    this.BIN_TYPE = 0xA1

    this.memory = memory;
    this.MEMORY_START = 0xFFF + 1;
    this.MEMORY_END = this.memory.length;
    this.HEAP_START = this.MEMORY_START + buffer.length;
    this.HEAP_MAX = (this.memory.length - (0xFFF + 1));
    this.STACK_BASE = 0xFFF;

    this.MAX_ITERATIONS = buffer.length + 10;
    this.step_debug = false;
    this.branch_debug = false;

    this.USE_FLAGS = false;
    this.ZERO_FLAG = false;

    this.registerNames = [
      "rtp", "rsp",
      "rip", "rhp",
      "r10", "r09",
      "r08", "r07",
      "r06", "r05",
      "r04", "r03",
      "r02", "r01",
    ];
    this.registers = VirtualMemoryBuffer(this.registerNames.length * 2);

    this.registerMap = this.registerNames.reduce((map, name, i) => {
      map[name] = i * 2;
      return map;
    }, {});

    this.setRegister("rhp", this.HEAP_START);
    this.setRegister("rip", this.MEMORY_START);
    this.setRegister("rsp", this.STACK_BASE);
    this.setRegister("rtp", 0x0);
    for (let i = 0; i < buffer.length; i++) {
      this.memory.setUint8(i + this.MEMORY_START, buffer[i]);
      //console.log(buffer[i]);
    }


    this.halt = false;
    this.exit_code = 0;
    this.current_step = 0;
  }

  addMetaData(code) {
    switch (code) {
      case 0x00: return;
      case 0x1F: {
        this.USE_FLAGS = true;
        return;
      }
    }
    return;
  }

  exportAsFunction(program) {
    return (...args) => {
      this.step_debug = false;
      for (let i = 0; i < args.length; i++) {
        const addr = this.offsetAsHeapAddress(i);
        this.heapStoreImm8(addr, args[i]);
      }
      return this.run();
    }
  }

  useDebugger(_debugger) {
    switch (_debugger) {
      case STEP_DEBUGGER: this.step_debug = true; return;
      case BRANCH_DEBUGGER: this.branch_debug = true; return;
    }
    return;
  }


  debug() {
    if (this.branch_debug) {
      console.log(`step (${this.current_step + 1}) | instruction ptr: ${this.getRegister("rip")}`);
      return;
    }
    if (this.step_debug) {
      console.log(`step: ${this.current_step + 1}`);
      console.log(`stack ptr: ${this.getRegister("rsp")}`);
      console.log(`flags (${(this.USE_FLAGS) ? 'y' : 'n'}): |Z: ${this.ZERO_FLAG}|`)
      console.log("stack snapshot:");
      for (let i = this.STACK_BASE; i >= 0; i--) {
        let value = this.memory.getUint8(i);
        console.log(`${i}: ${value}`);
        if (value == 0) break
      }
      console.log("");
      return;
    }
  }

  lastResultTruthy() {
    if (this.USE_FLAGS) {
      return this.ZERO_FLAG === true;
    }
    return this.pop(8) === 1;
  }

  compareResult(res) {
    if (this.USE_FLAGS) {
      this.ZERO_FLAG = res;
      return;
    }
    this.push(8, res);
  }

  offsetAsHeapAddress(offset) {
    const addr = this.HEAP_START + offset;
    return (addr >= this.HEAP_MAX) ? this.HEAP_MAX : addr;
  }

  getBitSize(n) {
    n = n - ((n >> 1) & 0x55555555)
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
    return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
  }

  getRegister(name) {
    if (!(name in this.registerMap)) {
      throw new Error(`getRegister: No such register '${name}'`);
    }
    return this.registers.getUint16(this.registerMap[name]);
  }

  setRegister(name, value) {
    if (!(name in this.registerMap)) {
      throw new Error(`setRegister: No such register '${name}'`);
    }
    return this.registers.setUint16(this.registerMap[name], value);
  }

  heapStoreAuto(size, offset, value) {
    switch (size) {
      case 8: return this.heapStoreImm8(offset, value);
      case 16: return this.heapStoreImm16(offset, value);
    }
    console.error(`heapStoreAuto: Invalid size ${size}`);
    return;
  }

  heapLoadAuto(size, addr) {
    switch (size) {
      case 8: return this.heapLoad8(addr);
      case 16: return this.heapLoad16(addr);
    }
    console.error(`heapStoreAuto: Invalid size ${size}`);
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
    const nextInstructionAddress = this.getRegister('rip');
    const instruction = this.memory.getUint8(nextInstructionAddress);
    this.setRegister('rip', nextInstructionAddress + 1);
    return instruction;
  }

  fetch16() {
    const nextInstructionAddress = this.getRegister('rip');
    const instruction = this.memory.getUint16(nextInstructionAddress);
    this.setRegister('rip', nextInstructionAddress + 2);
    return instruction;
  }

  fetch32() {
    const nextInstructionAddress = this.getRegister('rip');
    const instruction = this.memory.getUint32(nextInstructionAddress);
    this.setRegister('rip', nextInstructionAddress + 4);
    return instruction;
  }

  fetchBySize(size) {
    switch (size) {
      case 8: return this.fetch();
      case 16: return this.fetch16();
      case 32: return this.fetch32();
    }
    console.error(`fetchBySize: Invalid size ${size}`);
    return;
  }

  push(size, value) {
    const topOfStack = this.getRegister("rsp") - (size / 8);
    switch (size) {
      case 8: this.memory.setUint8(topOfStack, value); break;
      case 16: this.memory.setUint16(topOfStack, value); break;
      case 32: this.memory.setUint32(topOfStack, value); break;
      default: console.error(`push: Invalid size '${size}' (value ${value})`);
    }
    this.setRegister("rsp", topOfStack)
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
      default: console.error(`pop (retrieve): Invalid size '${size}'`);
    }
    this.setRegister("rsp", topOfStack + (size / 8));
    return value;
  }

  execute(instruction) {
    switch (instruction) {
      case NOP: {
        return;
      }

      case META: {
        const data = this.fetch();
        this.addMetaData(data);
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
        const addr = this.fetch();
        this.setRegister("rip", addr);
        return;
      }

      case JPRA: {
        const addr = this.fetch();
        const rip = this.getRegister("rip");
        this.setRegister("rip", rip + addr);
        return;
      }

      case JPR: {
        const addr = this.fetch();
        const rip = this.getRegister("rip");
        this.setRegister("rip", rip - addr);
        return;
      }

      case JZE: {
        const addr = this.fetch();
        if (this.lestResultTruthy()) {
          this.setRegister("rip", addr);
        }
        return;
      }

      case JER: {
        const addr = this.fetch();
        if (this.lastResultTruthy()) {
          const rip = this.getRegister("rip");
          this.setRegister("rip", rip - addr);
        }
        return;
      }

      case JERA: {
        const addr = this.fetch();
        if (this.lastResultTruthy()) {
          const rip = this.getRegister("rip");
          this.setRegister("rip", rip + addr);
        }
        return;
      }

      case BINARY: {
        this.BIN_TYPE = this.fetch();
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
    }
  }

  step() {
    const instruction = this.fetch();
    return this.execute(instruction);
  }

  run() {
    var i = 0;
    while (!this.halt) {
      this.step();
      if (this.halt) break;
      if (i >= this.MAX_ITERATIONS) {
        console.error("Segmentation Fault: Reached CPU iteration limit");
        return 1;
      }

      this.debug();
      this.current_step += 1;
      i += 1;
    }
    if (this.step_debug) {
      console.log("\nHEAP SUMMARY:")
      for (let i = this.HEAP_START; i <= this.getRegister("rhp") + 5; i++) {
        console.log(`${i}: ${this.memory.getUint8(i)}`)
      }
      console.log("");
    }
    return this.exit_code;
  }
}

const KtroInstance = (memory, buffer) => {
  return new KtroVirtualMachine(memory, buffer);
}

module.exports = {
  STEP_DEBUGGER,
  BRANCH_DEBUGGER,
  KtroInstance,
  VirtualMemoryBuffer,
  PackageProgram,
  FromPackage,
  CONST,
  ADD,
  HLT,
  CMPEQ,
  CMPNE,
  CMPGT,
  CMPLT,
  CMPGE,
  CMPLE,
  CMAEQ,
  CMANE,
  STO,
  LDA,
  LDS,
  POPL,
  DEL,
  NOP,
  BINARY,
  META,
  JMP,
  JE,
  JNE,
  JZE,
  JPR,
  JPRA,
  JER,
  JERA,
  JNR,
  JNRA,
  JZR,
  JZRA,
  CZF,
  CAF,
  
  U8,
  U16,
  U32,
}
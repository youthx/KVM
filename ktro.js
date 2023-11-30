/*
The KTRO Virtual Machine 
This machine can compile KTRO Packages to run with JS.

* CURRENTLY SUPPORTS 8-BIT PROGRAMS
* PROJECT WILL BE FINISHED & READY IN 2024

* Todo:
  - Add support for signed numbers
  - Add support for 16, 32, and 64 bit ints,
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
  return fs.writeFile(output, new Uint8Array(Buffer.from(program)), (err) => {
    if (err) return err;
    return 0;
  });
}


const FromPackage = (package) => {
  return new Uint8Array(
    Buffer.from(
      fs.readFileSync(package, "binary")
    )
  );
}

const VirtualMemoryBuffer = sizeInBytes => {
  const ab = new ArrayBuffer(sizeInBytes);
  const dv = new DataView(ab);
  return dv;
};

const NOP = 0x00;
const BINARY = 0x01;

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
const STO = 0x1A;
const LLC = 0x2A;
const LGB = 0x3A;
const POPL = 0x4A;
const DEL = 0x5A;

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
    this.BIN_TYPE = 0xA1

    this.memory = memory;
    this.MEMORY_START = 0xFFF + 1;
    this.MEMORY_END = this.memory.length;
    this.HEAP_START = this.MEMORY_START + buffer.length;
    this.HEAP_MAX = (this.memory.length - (0xFFF + 1));
    this.STACK_BASE = 0xFFF;

    this.MAX_ITERATIONS = buffer.length + 10;
    this.step_debug = false;

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
    }

    this.halt = false;
    this.exit_code = 0;
    this.current_step = 0;
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
  
  useDebugger() {
    this.step_debug = true;
  }

  debug() {
    if (!this.step_debug) return;
    console.log(`step: ${this.current_step + 1}`);
    console.log(`stack ptr: ${this.getRegister("rsp")}`)
    console.log("stack snapshot:");
    for (let i = this.STACK_BASE; i >= 0; i--) {
      let value = this.memory.getUint8(i);
      console.log(`${i}: ${value}`);
      if (value == 0) break
    }
    console.log("");
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
    const topOfStack = this.getRegister("rsp");
    switch (size) {
      case 8: this.memory.setUint8(topOfStack, value); break;
      case 16: this.memory.setUint16(topOfStack, value); break;
      case 32: this.memory.setUint32(topOfStack, value); break;
      default: console.error(`push: Invalid size '${size}' (value ${value})`);
    }
    this.setRegister("rsp", topOfStack - (size / 8))
    return;
  }

  pop(size) {
    let topOfStack = this.getRegister("rsp") + (size / 8);
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
        this.memory.setUint8(topOfStack, 0);
        break;
      }
      case 32: {
        value = this.memory.getUint32(topOfStack);
        this.memory.setUint32(topOfStack, 0);
        break;
      }
      default: console.error(`pop (retrieve): Invalid size '${size}'`);
    }
    this.setRegister("rsp", topOfStack);
    return value;
  }

  execute(instruction) {
    switch (instruction) {
      case NOP: {
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

      case LLC: {
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
        const exit_code = this.pop(U8);
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
        this.push(8, res);
        return;
      }

      case CMPNE: {
        const size = this.fetch();
        const left = this.pop(size);
        const right = this.pop(size);
        const res = left !== right;
        this.push(8, res);
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
  LLC,
  LGB,
  POPL,
  DEL,
  NOP,
  BINARY,

  U8,
  U16,
  U32,
}
## KTRO Virtual Machine

KTRO is a virtual machine designed to execute `.pkg` files containing bytecode instructions. It has been created primarily to execute programs written in the KTRO programming language, which compiles down to its bytecode. While currently operating as an 8-bit system, it aims to evolve into higher bit architectures in the future. The project includes an assembler/linker called `ktroasm.py`, enabling the generation of bytecode from source files.

### Instructions Set

The KTRO VM provides a set of instructions used in bytecode programming:

*Instructions belonging to different categories:*

- **Directives:**
  - `.data`, `.section`, `.offset`, `.asciz`, `.extern`

- **Instructions:**
  - `STO`, `LDS`, `JMP`, `JZE`, `HLT`, `CMPEQ`, `CMPNE`, `CMPGT`, `CMPLT`, `CMPGE`, `CMPLE`, `ASCIZ`, `EXTERN`, and more.

### How to Run KTRO VM in JavaScript

KVM Bytecode text format
```assembly
(package (.data 0) (
  .offset 1 # ALWAYS offset by 1
  .asciz ("Hello world" 10) $msg
  .func (0 $entry) (
    syscall 1 0 =msg
    u8.const 0
    u8.halt
  .end)
))
```
* If you are using the KVM Text format, first compile it to a package file with
 ```bash
 > python ktroasm.py <file>
```

To execute KTRO bytecode in JavaScript:
```javascript
const { FromPackage, KtroInstance, VirtualMemoryBuffer, U8 } = require('ktro');

let bytes = FromPackage("./a.pkg");
let instance = KtroInstance(
  VirtualMemoryBuffer(1024 * 1024),
  bytes
);

let exitCode = instance.run();
console.log(`Exit code: ${exitCode}`);

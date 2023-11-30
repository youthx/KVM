const { PackageProgram, KtroInstance, VirtualMemoryBuffer, CONST, U8, CMPEQ, ADD, HLT, STO, LLC, FromPackage, DEL, BINARY } = require("./ktro");

// -------------------------------------------
// Exporting a program as a JS function ------
// -------------------------------------------
const myFunctionBytes = [
  BINARY, 0xA1,           // (metadata) A1h (Inline) 

  LLC, U8, 0,             // access first arg
  LLC, U8, 1,             // access second arg
  ADD, U8,                // pops and adds two topmost items of stack (first arg, second arg) and push  

  // free heap memory used
  DEL, U8, 0,             // free the value at offset (0)
  DEL, U8, 1,             // free the value at offset (1)
  HLT                     // Close the program
  // ** the return value is whatever is on the topmost of the stack
];

const instance = KtroInstance(
  VirtualMemoryBuffer(1024 * 1024),
  myFunctionBytes
);

const myFunction = instance.exportAsFunction();
let result = myFunction(5, 5);
console.log(result);
// -------------------------------------------



// -------------------------------------------
// Running A Program  ------------------------
// -------------------------------------------
const programBytes = [
  BINARY, 0xA1,           // (metadata) A1h (Inline) 

  CONST, U8, 15,          // push byte 15
  CONST, U8, 12,          // push byte 12
  STO, U8, 1,             // store top of stack (12) to memory with offset (1)
  STO, U8, 0,             // store top of stack (15) to memory with offset (0)

  CONST, U8, 3,           // push byte 3
  LLC, U8, 1,             // load byte (12) at offset (1) to top of stack
  ADD, U8,                // pops and adds two topmost items of stack (3, 12) and push value to stack (15)

  LLC, U8, 0,             // load byte (15) at offset (0) to top of stack
  ADD, U8,                // pops and adds two topmost items of stack (15, 15) and push value to stack (30)
  CONST, U8, 30,          // push byte 30
  CMPEQ, U8,              // pops and compares equal to topmost elements (30, 30) and pushes result (1) 

  // free heap memory used
  DEL, U8, 0,             // free the value at offset (0)
  DEL, U8, 1,             // free the value at offset (1)

  // ** the return value is whatever is on the topmost of the stack
  HLT                     // close the program
];

saveProgram();
// Wait for program to save to file
setTimeout(runProgram, 1000);

function saveProgram() {
  console.log("Saving Program...")
  PackageProgram("test.pkg", programBytes);
}

function runProgram() {
  console.clear();

  const program = FromPackage("test.pkg");

  const instance = KtroInstance(
    VirtualMemoryBuffer(1024 * 1024),
    program
  );

  const exitCode = instance.run();
  console.info(`exit: ${exitCode}`);
}
// -------------------------------------------
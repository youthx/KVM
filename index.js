/*
** THIS FILE IS NOT AN EXAMPLE ON HOW TO USE THE KVM **
For examples, go to examples.js

This file is used for debugging & testing.
*/

const { PackageProgram, KtroInstance, VirtualMemoryBuffer, LDS, CONST, U8, U16, CMPEQ, ADD, HLT, STO, POPL, FromPackage, DEL, BINARY, META, JPR, JPRA, JERA, JZRA, BRANCH_DEBUGGER, STEP_DEBUGGER } = require("./ktro");

const bytes = [
  BINARY, 0xA1,
  META, 0x1F,
  CONST, U8, 69,
  HLT, U8
];

saveProgram(bytes);
// Wait for program to save to file
setTimeout(runProgram, 1000);

function saveProgram(programBytes) {
  console.log("Saving Program...")
  PackageProgram("test.pkg", programBytes);
}

function runProgram() {
  console.clear();

  program = FromPackage('test.pkg');

  const instance = KtroInstance(
    VirtualMemoryBuffer(1024 * 1024),
    program
  );
  const exitCode = instance.run();
  console.info(`exit: ${exitCode}`);
  process.exit(exitCode);
}
// -------------------------------------------
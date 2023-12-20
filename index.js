/*
** THIS FILE IS NOT AN EXAMPLE ON HOW TO USE THE KVM **
This file is used for debugging & testing.
*/
import {exec} from "child_process";

import * as readlineSync  from "readline-sync";
import * as exports from "./ktro.js"
Object.entries(exports).forEach(([name, exported]) => global[name] = exported);

let bytes = FromPackage("./a.pkg");
let instance = KtroInstance(
  VirtualMemoryBuffer(1024 * 1024),
  bytes
);
let exitCode = instance.run();

let namespace = {
  namespaceID: 0,
  jsFunctions: [
    (kvm) => {
      let offset = kvm.getArgument(Integer32);
      let buf = readlineSync.question("");
      kvm.storeStringToHeap(offset, buf);
      return kvm.resultValue(buf.length, Integer32);
    },
  ]
};

console.clear();
console.log("interactive ktro bytecode runner\ncmds: run/rq/exit")
readlineSync.promptCLLoop({
  rq: function() {
    instance.reset(bytes);
    instance.addNamespace(namespace);
    console.log("-- PROGRAM --\n")
    let exit = instance.run();
    console.log("--------------")
    console.log(`exit code: ${exit}`);
    process.exit(exit);
  },
    
  run: function() {
    instance.reset(bytes);
    instance.addNamespace(namespace);
    console.log("-- PROGRAM --\n")
    let exit = instance.run();
    console.log("--------------")
    console.log(`exit code: ${exit}`);
  },
  clear: function() { console.clear() },
  exit: function() { process.exit(0); }
});
console.log('Exited');
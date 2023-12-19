/*
** THIS FILE IS NOT AN EXAMPLE ON HOW TO USE THE KVM **
For examples, go to examples.js

This file is used for debugging & testing.
*/

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
      let num = kvm.getArgument(U8);
      console.log(num);
    },
  ]
};
console.clear();
console.log("interactive ktro bytecode runner\ncmds: run/reload/exit")
readlineSync.promptCLLoop({
  reload: function() {
    bytes = FromPackage("./a.pkg");
    instance = KtroInstance(
      VirtualMemoryBuffer(1024 * 1024),
      bytes
    );
    instance.addNamespace(namespace);
  },
  
  run: function() {
    instance.reset(bytes);
    instance.addNamespace(namespace);
    let exit = instance.run();
    console.log(`exit code: ${exit}`);
    
  },
  clear: function() { console.clear() },
  exit: function() { process.exit(0); }
});
console.log('Exited');
/*
** THIS FILE IS NOT AN EXAMPLE ON HOW TO USE THE KVM **
For examples, go to examples.js

This file is used for debugging & testing.
*/

import * as readlineSync  from "readline-sync";

import * as exports from "./ktro.js"
Object.entries(exports).forEach(([name, exported]) => global[name] = exported);

const bytes = FromPackage("./a.pkg");
const instance = KtroInstance(
  VirtualMemoryBuffer(1024 * 1024),
  bytes
);

instance.addNamespace({
  namespaceID: 0,
  jsFunctions: [
    (handle) => {
      const arg = handle.getArgument(U8);
      print(handle.heapLoad8(handle.offsetAsHeapAddress(arg)))
      handle.externInterrupt(1, [arg]);
    }
  ]
})

let code = instance.run();
console.log(`finished: ${code}`);
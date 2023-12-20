(package (.data 0) (
  .extern 0 $lib (1 $prompt)
  .offset 1
  
  .func (0 $entry) (
    i32.const 1
    extern <lib.prompt>
    i32.sto 0xff
    i32.ld 0xff
    i32.const 1
    i32.add 
    i32.const 69
    i32.stat
    i32.ld 0xff
    i32.halt
  .end)
))
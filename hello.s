(package (.data 0) (
  .offset 1
  .asciz ("Hello, world!" 10) $hello
  
  .func (0 $entry) (
    syscall 1 0 =hello
    i32.const 0
    i32.halt
  .end)
))
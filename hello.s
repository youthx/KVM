(package (.data 0) (
  .offset 1 # ALWAYS offset by 1
  .asciz ("Hello world" 10) $msg
  .func (0 $entry) (
    syscall 1 0 =msg
    u8.const 0
    u8.halt
  .end)
))
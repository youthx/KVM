(package (.data 0) (
  .extern 0 $fmw (1 $num)
  .offset 1
  .asciz ("Fizz" 10) $fizzm
  .asciz ("Buzz" 10) $buzzm
  .asciz ("FizzBuzz" 10) $fizzbuzzm
  
  .byte 20 $to    # fizzbuzz to 20
  .byte 0xff $idx # points to address 0xff which olds the current index for the loop
  
  .func (0 $entry) (
    u8.const 0
    u8.sto =idx
    
    $loop:
    u8.pop
    u8.ld =idx
    u8.const 3
    u8.mod
    u8.ld =idx
    u8.const 5
    u8.mod
    u8.and
    jze 2
    jmp 1
    %2:
    syscall 1 0 =fizzbuzzm
    u8.ld =idx
    u8.const 3
    u8.mod
    jze 3
    jmp 1
    %3:
    syscall 1 0 =fizzm
    u8.ld =idx
    u8.const 5
    u8.mod
    jze 4
    jmp 1
    %4:
    syscall 1 0 =buzzm
    
    %1:
    u8.ld =idx
    extern <fmw.num>
    u8.ld =idx
    u8.ld =idx
    u8.inc
    u8.sto =idx
    u8.const =to
    u8.cmpeq
    jze =loop

  
    u8.ld =idx
    u8.halt
  .end)
))
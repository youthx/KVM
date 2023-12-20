(package (.data 0) (
  .extern 0 $fmw (1 $num)
  .offset 1
  .asciz ("Fizz" 10) $fizzm
  .asciz ("Buzz" 10) $buzzm
  .asciz ("FizzBuzz" 10) $fizzbuzzm
  
  .byte 20 $to    # fizzbuzz to 20
  .byte 0xff $idx # points to address 0xff which olds the current index for the loop
  
  .func (0 $entry) (
    i32.const 0
    i32.sto =idx
    
    $loop:
    i32.pop
    i32.ld =idx
    i32.const 3
    i32.mod
    i32.ld =idx
    i32.const 5
    i32.mod
    i32.and
    jze 2
    jmp 1
    %2:
    syscall 1 0 =fizzbuzzm
    i32.ld =idx
    i32.const 3
    i32.mod
    jze 3
    jmp 1
    %3:
    syscall 1 0 =fizzm
    i32.ld =idx
    i32.const 5
    i32.mod
    jze 4
    jmp 1
    %4:
    syscall 1 0 =buzzm
    
    %1:
    i32.ld =idx
    extern <fmw.num>
    i32.ld =idx
    i32.ld =idx
    i32.inc
    i32.sto =idx
    i32.const =to
    i32.cmpeq
    jze =loop

  
    i32.ld =idx
    i32.halt
  .end)
))
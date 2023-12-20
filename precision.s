# unsigned, signed integer test
(package (.data 0) (
  .extern 0 $tests (1 $precision)
  .func (0 $entry) (
    u8.const 100
    i8.const -100
    extern <tests.precision>
    i8.halt
  .end)
))
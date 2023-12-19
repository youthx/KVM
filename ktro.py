from dis import get_instructions, dis
from inspect import signature as f_signature
from os import path as os_path

def __getname__():
    return os_path.splitext(os_path.basename(__file__))[0]

def debug_dis(func):
  d = get_instructions(func)
  for inst in d:
    print(f'[{inst.opcode}] {inst.opname} ({inst.arg})')

def ktro_function(func, byte_signature: int):
  sign = f_signature(func)
  generated = [0x06, byte_signature]
  for param in range(len(sign.parameters)):
    generated.extend([0x0a, 8, param])

  disassembly = get_instructions(func)
  for instruction in disassembly:
    match instruction.opcode:
      case 100: # LOAD_CONST
        generated.extend([0x10, 8, instruction.arg])
      case 124: # LOAD_FAST
        generated.extend([0x1a, 8, instruction.arg])
      case 23: # BINARY_ADD
        generated.extend([0x11, 8])
      case 83: # RETURN_VALUE
        if byte_signature == 0:
          generated.extend([0x12, 8])
        else:
          generated.append(0x5c)
  #print(generated)
  return generated


class Package:
  def __init__(self, name):
    self.name = name
    self.opcodes = [
      0xfa, 0xfa, 0x00, 0x01, 
      0xa2, 0xfa, 0xfa, 0x01
    ]
    self.functions = {}


  def generate_file(self):
    with open(self.name + ".pkg", "wb") as f:
      f.write(bytes(bytearray(self.opcodes)))
  
class Function:
  offset = 0

  @classmethod
  def __align__(cls):
    cls.offset += 1
    return cls.offset 
    
  def __init__(self, package: Package, is_entry=False):
    self.is_entry = is_entry
    self.package = package
    self.opcodes = []

  def __call__(self, func):
    offset = 0 if self.is_entry else Function.__align__()
    self.opcodes = ktro_function(func, offset)
    self.package.functions[func.__name__] = offset
    self.package.opcodes.extend(self.opcodes)
    return func
    
  def gen(self):
    return self.opcodes

package = Package("frompy")
@Function(package=package, is_entry=True)
def foo():
  return 12

debug_dis(foo)
package.generate_file()
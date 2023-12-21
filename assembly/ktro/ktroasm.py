from lark import Lark, Tree, Visitor, Token
from os import path
from sys import argv
from .gram import GRAMMAR

def unsigned_to_signed(value, bl):
  if value & (1 << (bl - 1)):
      return value - (1 << bl)
  else:
      return value

def signed_to_unsigned(value, bl):
  return value % (1 << bl)

class Processor(Visitor):
  OPCODES = {
    "null": 0x00, "__void__": 0x00,
    "u8": 8, "u16": 16, "u32": 32, "i8": 8, "i16": 16, "i32": 32,
    "section": 0xfa, "binary": 0x01, "syscall": 0x02, "interrupt": 0x02,
    "meta": 0x03, "func": 0x06, "label": 0x07,
    "const": 0x10, "add": 0x11, "halt": 0x12, "hlt": 0x12,
    "cmpeq": 0x13, "cmpne": 0x14, "test": 0x13, "cmp": 0x13,
    "cmpgt": 0x15, "cmplt": 0x16, "cmpge": 0x17, "cmple": 0x18,
    "asciz": 0x19, "extern": 0x20, "store": 0x0a, "sto": 0x0a, "sb": 0x0a,
    "load": 0x1a, "ld": 0x1a, "lds": 0x1a, "pop": 0x2a, "popl": 0x2a,
    "del": 0x3a, "sub": 0xaa, "mul": 0xba, "div": 0xca, "jmp": 0x5b,
    "jze": 0x8b, "jne": 0x8b, "call": 0x4c, "ret": 0x5c, "offset": 0xbb,
    "and": 0xcb, "or": 0xdb, "shl": 0xec, "shr": 0xfc, "xor": 0x0c, 
    "not": 0x1c, "nor": 0x2c, "inc": 0x0b, "dec": 0x1b, "dup": 0x4a,
    "mod": 0x2b, "sf": 0x8a, "csf": 0x9a, "std": 0x6c, "ldd": 0x7a,
    "ldsd": 0x7a, "stsd": 0x6c, "ldat": 0x7a, "stat": 0x6c
  }
  
  def __init__(self):
    super().__init__()

    self.opcodes = [0x70, 0x6b, 0x67]
    self.data_opcodes = []
    self.labels = {}
    self.jmp_labels = 0
    self.heap_offset_ptr = 0
    
  def visit(self, tree: Tree):
    if not isinstance (tree, Tree):
      return tree 
    return getattr(self, tree.data, lambda _: tree)(tree)

  def emit_data(self, opcodes: list):
    new_opcodes = []
    for op in opcodes:
      op = int(self.OPCODES.get(op, op))
      new_opcodes.append(op)
    self.data_opcodes.extend(new_opcodes)
    
  def emit(self, opcodes: list):
    new_opcodes = []
    for op in opcodes:
      op = int(self.OPCODES.get(op, op))
      new_opcodes.append(op)
    self.opcodes.extend(new_opcodes)

  def package_to_file(self, path="./a", bits=32):
    ops = bytes(bytearray(self.opcodes))
    with open(f"{path}.pkg", "wb") as f:
      f.write(ops)
    return
      
  def inst_typeless(self, tree: Tree):
    inst = str(self.visit(tree.children.pop(0)))
    self.emit([inst])

    operands = [int(str(self.visit(op))) for op in tree.children]
    self.emit(operands)
    return tree

  def module(self, tree: Tree):
    for child in tree.children:
      self.visit(child)
    
    return tree

  def body(self, tree: Tree):
    for child in tree.children:
      self.visit(child)
      
  def binary(self, tree: Tree):
    self.emit(["section", 0xfa, 0, "binary", 0xa2])
    for child in tree.children:
      self.visit(child)
      
    return tree

  def ddata(self, tree: Tree):
    self.emit(["section", 0xfa, 1])
    for child in tree.children:
      byte = int(str(self.visit(child)))
      self.emit(["meta", byte])
    return tree 

  def dextern(self, tree: Tree):
    last = None
    for child in tree.children: 
      value = self.visit(child)
      if isinstance(value, Token):
        self.labels[value] = int(str(last))     
      else:
        last = value
    return tree 
    
  def dasciz(self, tree: Tree):
    label = None
    if isinstance(tree.children[-1], Token) and tree.children[-1].type == 'IDENTIFIER':
      label = str(tree.children[-1])
    bytes = []
    for child in tree.children[:-1]:
      byte = str(self.visit(child))
      if byte[0] == '"':
        bytes.extend([str(ord(b)) for b in byte[1:-1]])
        continue 
      if byte.startswith("0x"):
        byte = str(int(byte, 16))
      bytes.append(str(byte))
    bytes.extend(["0"])
    
    if label:
      self.labels[label] = self.heap_offset_ptr 
    self.heap_offset_ptr += len(bytes)
    opcodes = ["asciz", len(bytes), *bytes]
    self.emit_data(opcodes)

  def inst_typed(self, tree: Tree):
    size = str(tree.children.pop(0))
    inst = str(tree.children.pop(0))
    is_signed = size[0] == 'i'
    if (is_signed):
      self.emit(["sf"])
      
    op_size = self.OPCODES[size]
    
    self.emit([inst, size])
    operands = []
    for op in tree.children:
      num = int(str(self.visit(op)))
      match op_size:
        case 8:
          operands.append(num & 0xff)
        case 16:
          operands.extend([
            (num >> 8) & 0xff, 
            (num & 0xff)])
        case 32:
          operands.extend([
            (num >> 24) & 0xff,
            (num >> 16) & 0xff,
            (num >> 8)  & 0xff,
            (num)       & 0xff
          ])
        case _:
          print(f"error: invalid size {size}")
    if len(operands) > 0:
      self.emit(operands)
    return tree
    
  def operand_ref(self, tree: Tree):
    return str(self.labels[str(self.visit(tree.children[0]))])


  def operand_extref(self, tree: Tree):
    first = str(self.visit(tree.children[0]))
    second = str(self.visit(tree.children[1]))
    
    if first[0] in "0123456789":
      self.emit([first])
    else:
      self.emit([self.labels[first]])
    if second[0] in "0123456789":
      return int(second)
    else:
      return int(self.labels[second])
      
  def operand_imm(self, tree: Tree):
    op = int(str(self.visit(tree.children[0])))
    return op

  def doffset(self, tree: Tree):
    align = int(str(self.visit(tree.children.pop(0))))
    label = None 
    if len(tree.children) > 0:
      if isinstance(tree.children[0], Token) and tree.children[0].type == 'IDENTIFIER':
        label = str(self.visit(tree.children.pop(0)))
        self.labels[label] = self.heap_offset_ptr 
    self.heap_offset_ptr += align
    self.emit_data(["offset", align])
    return tree 
    
  def dbyte(self, tree: Tree):
    byte = int(str(self.visit(tree.children.pop(0))))
    label = None 
    if len(tree.children) > 0:
      if isinstance(tree.children[0], Token) and tree.children[0].type == 'IDENTIFIER':
        label = str(self.visit(tree.children.pop(0)))
        self.labels[label] = byte
    return tree 
    
  def dfunc(self, tree: Tree): 
    id = int(str(self.visit(tree.children.pop(0))))
    label = None 
    if isinstance(tree.children[0], Token) and tree.children[0].type == 'IDENTIFIER':
      label = str(self.visit(tree.children.pop(0)))
      self.labels[label] = id 

    self.emit(["func", 0xfa, id])
    if id == 0:
      self.emit(self.data_opcodes)

    for child in tree.children:
      self.visit(child)
      
    self.emit(["ret"])
    return tree

  def anon_label(self, tree: Tree):
    to = str(self.visit(tree.children.pop(0)))
    self.emit(["label", 0xfa, to])
    return tree 
    
  def jmp_label(self, tree: Tree):
    label = str(self.visit(tree.children.pop(0)))
    self.labels[label] = self.jmp_labels
    bytes = ["label", 0xfa, self.jmp_labels]
    self.emit(bytes)
    self.jmp_labels += 1
    return tree
    
    
  def mul(self, tree: Tree):
    lhs = str(self.visit(tree.children[0]))
    rhs = str(self.visit(tree.children[1]))
    return int(lhs) * int(rhs)
    
  def div(self, tree: Tree):
    lhs = str(self.visit(tree.children[0]))
    rhs = str(self.visit(tree.children[1]))
    return int(lhs) / int(rhs)

  def add(self, tree: Tree):
    lhs = str(self.visit(tree.children[0]))
    rhs = str(self.visit(tree.children[1]))
    return int(lhs) + int(rhs)

  def sub(self, tree: Tree):
    lhs = str(self.visit(tree.children[0]))
    rhs = str(self.visit(tree.children[1]))
    return int(lhs) - int(rhs)

  def char(self, tree: Tree):
    c = tree.children[0]

    if isinstance(c, Tree):
      while isinstance(c, Tree):
        c = c.children[0]
    else:
      c = str(c)
      
    return ord(str('' if c == '' else c[0]))
  
  def number(self, tree: Tree): 
    num = tree.children[0]
    if isinstance(num, Tree):
      while isinstance(num, Tree):
        num = num.children[0]
    else:
      num = str(num)
    
    if num.startswith("0x"):
      
      num = str(int(num[2:], 16))
    return int(num)

  def unary_pos(self, tree: Tree):
    return int(str(self.visit(tree.children[0])))

  def unary_neg(self, tree: Tree):
    return int(str(self.visit(tree.children[0]))) * -1


current_dir = path.dirname(path.abspath(__file__))

def main():
  if (len(argv) < 2):
    print(f"usage: {argv[0]} <file>")
    exit(1)

  # Create a parser
  parser = Lark(GRAMMAR, parser='lalr')

  # Parse an expression
  f = open(argv[1], "r")
  expression = f.read()
  f.close()

  tree = parser.parse(expression)
  proc = Processor()
  try:
    result = proc.visit(tree)
    proc.package_to_file()
  except KeyError as e:
    print(f"error: invalid opcode for '{e.args[0]}'")

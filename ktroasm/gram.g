?start: module

module: "(" module ")"
      | binary

binary: "package" ddata? "(" body ")" 
      | "package" ddata?

?stmt: "(" stmt ")"
    | dextern
    | dasciz
    | dbyte
    | doffset
    | dfunc

body: stmt*
dextern: ".extern" expr labeldecl? "(" (expr labeldecl?)* ")"
dasciz: ".asciz" "(" (STRING | expr)+ ")" labeldecl?
ddata: "(" ".data" ","? (expr ","?)+ ")" 
dfunc: ".func" "(" expr labeldecl? ")" "(" inst* ".end" ")"
dbyte: ".byte" labeldecl
doffset: ".offset" expr labeldecl?

?inst: "(" inst ")"
     | (IDENTIFIER "." IDENTIFIER operand*) -> inst_typed
     | IDENTIFIER operand* -> inst_typeless

?operand: "(" operand ")"
       | expr             -> operand_imm
       | "=" IDENTIFIER   -> operand_ref
       | "<"(expr | IDENTIFIER)"."(expr | IDENTIFIER)">" -> operand_extref
       
       
?labeldecl: "(" labeldecl ")"
          | "$" IDENTIFIER

?expr: term
     | expr "+" term -> add
     | expr "-" term -> sub

?term: factor
     | term "*" factor -> mul
     | term "/" factor -> div

?factor: NUMBER -> number
       | CHAR   -> char
       | "(" expr ")"


CHAR: /'.'/ 
STRING: /"[^"]*"/
IDENTIFIER: /[a-zA-Z_][a-zA-Z0-9_]*/
COMMENT: "#" /[^\n]/*
%ignore COMMENT

%extend NUMBER: /0x\w+/
%import common.NUMBER
%import common.WS
%ignore WS
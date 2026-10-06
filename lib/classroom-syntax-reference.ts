/**
 * Blank C++ patterns for classroom CodeBench prompts.
 * These are structure only — not solved assignments.
 */

export type ClassroomSyntaxTopicId =
  | "variables"
  | "input-output"
  | "comparison"
  | "if-else"
  | "else-if"
  | "nested-if"
  | "switch"
  | "ternary"
  | "while"
  | "for"
  | "nested-for"
  | "do-while"
  | "arrays"
  | "pointers"
  | "functions"
  | "matlab-commands"
  | "matlab-if"
  | "matlab-function"
  | "matlab-plot"
  | "matlab-arrays"

export type ClassroomSyntaxCard = {
  id: ClassroomSyntaxTopicId
  title: string
  note: string
  code: string
}

const CARDS: Record<ClassroomSyntaxTopicId, ClassroomSyntaxCard> = {
  variables: {
    id: "variables",
    title: "Variable types",
    note: "Declare a name and a type before you use it.",
    code: `int count = 0;
double price = 0.0;
char grade = 'A';
string name = "";
bool isReady = false;`,
  },
  "input-output": {
    id: "input-output",
    title: "Input and output",
    note: "cin reads a value. cout displays a value.",
    code: `#include <iostream>
using namespace std;

int value;
cout << "Enter a value: ";
cin >> value;
cout << "You entered: " << value << endl;`,
  },
  comparison: {
    id: "comparison",
    title: "Comparison operators",
    note: "A comparison is true or false. Use == to compare. Use = only to store a value.",
    code: `// ==   equal
// !=   not equal
// >    greater than
// <    less than
// >=   greater than or equal
// <=   less than or equal

if (score >= 70) {
    // condition is true
}`,
  },
  "if-else": {
    id: "if-else",
    title: "if / else",
    note: "One branch runs when the condition is true. The other runs when it is false.",
    code: `if (condition) {
    // true
} else {
    // false
}`,
  },
  "else-if": {
    id: "else-if",
    title: "if / else if / else",
    note: "Check the ranges from the first match to the last. Only one branch runs.",
    code: `if (condition1) {
    // first match
} else if (condition2) {
    // second match
} else {
    // nothing above matched
}`,
  },
  "nested-if": {
    id: "nested-if",
    title: "Nested if",
    note: "The inner check runs only when the outer condition is true.",
    code: `if (outerCondition) {
    if (innerCondition) {
        // both are true
    } else {
        // outer is true, inner is false
    }
} else {
    // outer is false
}`,
  },
  switch: {
    id: "switch",
    title: "switch",
    note: "Jump to the matching case. break stops the fall-through.",
    code: `switch (choice) {
    case 1:
        // option 1
        break;
    case 2:
        // option 2
        break;
    default:
        // any other value
        break;
}`,
  },
  ternary: {
    id: "ternary",
    title: "Ternary operator",
    note: "A short choice between two values. It is not a place for several statements.",
    code: `result = condition ? valueIfTrue : valueIfFalse;`,
  },
  while: {
    id: "while",
    title: "while loop",
    note: "The body repeats while the condition stays true. It can run zero times.",
    code: `while (condition) {
    // repeat
    // update something that can end the loop
}`,
  },
  for: {
    id: "for",
    title: "for loop",
    note: "Use this when you know how many times to repeat.",
    code: `for (int i = 0; i < n; i++) {
    // i is 0, 1, 2, ... n - 1
}`,
  },
  "nested-for": {
    id: "nested-for",
    title: "Nested for loops",
    note: "The inner loop finishes a full pass for each step of the outer loop.",
    code: `for (int row = 0; row < rows; row++) {
    for (int col = 0; col < cols; col++) {
        // one cell
    }
}`,
  },
  "do-while": {
    id: "do-while",
    title: "do-while loop",
    note: "The body runs once, then repeats while the condition is true.",
    code: `do {
    // runs at least once
} while (condition);`,
  },
  arrays: {
    id: "arrays",
    title: "Arrays",
    note: "One name holds several values. The first index is 0.",
    code: `int scores[5];
scores[0] = 90;
cin >> scores[i];
cout << scores[i];`,
  },
  pointers: {
    id: "pointers",
    title: "Pointers",
    note: "& is the address. * reads or changes the value at that address.",
    code: `int value = 10;
int* ptr = &value;
cout << *ptr;
*ptr = 20;`,
  },
  functions: {
    id: "functions",
    title: "Functions",
    note: "A function takes inputs and returns a result. main calls it.",
    code: `double calculateArea(double length, double width) {
    return length * width;
}

double area = calculateArea(8, 5);
cout << area << endl;`,
  },
  "matlab-commands": {
    id: "matlab-commands",
    title: "MATLAB commands",
    note: "A script runs from top to bottom. A semicolon hides the result.",
    code: `a = 15;
b = 7;
c = a^2 + b^2;
disp(c)`,
  },
  "matlab-if": {
    id: "matlab-if",
    title: "MATLAB if",
    note: "elseif and else are optional. end closes the decision.",
    code: `if value > 0
    disp("Positive")
elseif value < 0
    disp("Negative")
else
    disp("Zero")
end`,
  },
  "matlab-function": {
    id: "matlab-function",
    title: "MATLAB function",
    note: "The file name matches the function name. Outputs are listed on the left.",
    code: `function result = squareValue(number)
    result = number^2;
end`,
  },
  "matlab-plot": {
    id: "matlab-plot",
    title: "MATLAB plot",
    note: "Use element-wise operators (.*, ./, .^) when a vector is in the formula.",
    code: `x = -2:0.1:2;
y = x.^3 - 2*x + 1;
plot(x, y, 'b--', 'LineWidth', 2)
title('Function plot')
xlabel('x')
ylabel('y')
grid on`,
  },
  "matlab-arrays": {
    id: "matlab-arrays",
    title: "MATLAB vectors and matrices",
    note: "A colon builds a vector. A semicolon starts the next matrix row.",
    code: `x = 0:2:10;
A = [3 2 1; 5 1 0; 2 1 7];
secondRow = A(2, :);
element = A(2, 3);`,
  },
}

const ORDER: ClassroomSyntaxTopicId[] = [
  "variables",
  "input-output",
  "comparison",
  "if-else",
  "else-if",
  "nested-if",
  "switch",
  "ternary",
  "while",
  "do-while",
  "for",
  "nested-for",
  "arrays",
  "pointers",
  "functions",
  "matlab-commands",
  "matlab-if",
  "matlab-function",
  "matlab-plot",
  "matlab-arrays",
]

const MAX_CARDS = 7

function mentions(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

/** Pick only the blank patterns this classroom prompt needs. */
export function syntaxCardsForClassroomPrompt(title: string, questionText: string): ClassroomSyntaxCard[] {
  const text = `${title}\n${questionText}`.toLowerCase()
  if (/\bmatlab\b/.test(text)) {
    const selected = new Set<ClassroomSyntaxTopicId>(["matlab-commands"])
    if (mentions(text, /\bif\b|elseif|else/)) selected.add("matlab-if")
    if (mentions(text, /\bfunctions?\b/)) selected.add("matlab-function")
    if (mentions(text, /\b(plot|fplot|graph)\b/)) selected.add("matlab-plot")
    if (mentions(text, /\b(vector|matrix|matrices|colon|array|element-by-element)\b/)) {
      selected.add("matlab-arrays")
    }
    return ORDER.filter((id) => selected.has(id)).map((id) => CARDS[id])
  }

  const wantsProgram = mentions(text, /\b(c\+\+|cpp|program|cin|cout|inputs?|outputs?|enter|display|print|calculate|formula|task)\b/)
  const hasNestedIf = mentions(text, /\bnested\b|\bonly if\b|\bfirst check\b|\bthen check\b/)
  const numberedMenu = (text.match(/`\d+`\s*(?:→|->)/g) ?? []).length
  const arrowCount = (text.match(/→|->/g) ?? []).length
  const hasSwitch = mentions(text, /\bswitch\b|\bcase\s+\d/)
  const rangeChain = !hasSwitch && numberedMenu < 2 && arrowCount >= 2
  const hasElseIf =
    mentions(text, /else\s*-?\s*if/) ||
    rangeChain ||
    mentions(text, /\btiered\b|\bovertime\b|\bbeyond\b/)
  const ifIsOnlySwitchDefault =
    hasSwitch &&
    !hasElseIf &&
    !hasNestedIf &&
    !mentions(text, /\belse\b/) &&
    !mentions(text, /\bif\b[^.\n]{0,120}\b(less|greater|at least|more than|below|above)\b/)
  const hasIfElse =
    !ifIsOnlySwitchDefault &&
    (hasElseIf || mentions(text, /\belse\b|if\s*\/\s*else|\bif-else\b|\botherwise\b/))
  const hasIf =
    !ifIsOnlySwitchDefault && (hasIfElse || hasNestedIf || mentions(text, /\bif\b/))
  const hasTernary = mentions(text, /\bternary\b/)
  const hasDoWhile = mentions(text, /do\s*-?\s*while/)
  const hasWhile = !hasDoWhile && mentions(text, /\bwhile\s+loop\b|\bwhile\s*\(/)
  const hasNestedFor =
    mentions(text, /nested\s+(for|loop)/) ||
    (mentions(text, /\b(pattern|triangle|multiplication table)\b/) &&
      mentions(text, /\b(for|loop|nested)\b/))
  const hasFor = hasNestedFor || mentions(text, /\bfor\s+loop\b|\bfor\s*\(/)
  const hasArray = mentions(text, /\barrays?\b/)
  const hasPointer = mentions(text, /\bpointers?\b/)
  const hasComparison =
    hasIf ||
    hasTernary ||
    mentions(text, />=|<=|==|!=|\b(greater|less than|at least|no more than|equal|divisible)\b/)

  const selected = new Set<ClassroomSyntaxTopicId>()
  if (wantsProgram) {
    selected.add("variables")
    selected.add("input-output")
  }
  if (hasComparison && (hasIf || hasTernary || hasWhile || hasDoWhile || hasFor)) selected.add("comparison")
  if (hasElseIf) selected.add("else-if")
  else if (hasNestedIf || hasIfElse) selected.add("if-else")
  else if (hasIf) selected.add("if-else")
  if (hasNestedIf) selected.add("nested-if")
  if (hasSwitch) selected.add("switch")
  if (hasTernary) selected.add("ternary")
  if (hasWhile) selected.add("while")
  if (hasDoWhile) selected.add("do-while")
  if (hasFor) selected.add("for")
  if (hasNestedFor) selected.add("nested-for")
  if (hasArray) selected.add("arrays")
  if (hasPointer) selected.add("pointers")
  if (mentions(text, /\bfunctions?\b/)) selected.add("functions")

  const ranked = ORDER.filter((id) => selected.has(id))
  if (ranked.length <= MAX_CARDS) return ranked.map((id) => CARDS[id])

  const keep = new Set(ranked)
  const dropFirst: ClassroomSyntaxTopicId[] = ["comparison", "variables", "input-output", "for", "if-else"]
  for (const id of dropFirst) {
    if (keep.size <= MAX_CARDS) break
    if (id === "for" && keep.has("nested-for")) keep.delete(id)
    else if (id === "if-else" && (keep.has("else-if") || keep.has("nested-if"))) keep.delete(id)
    else if (id !== "for" && id !== "if-else") keep.delete(id)
  }
  return ORDER.filter((id) => keep.has(id)).slice(0, MAX_CARDS).map((id) => CARDS[id])
}

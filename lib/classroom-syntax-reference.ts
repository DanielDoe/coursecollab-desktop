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
]

const MAX_CARDS = 7

function mentions(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

/** Pick only the blank patterns this classroom prompt needs. */
export function syntaxCardsForClassroomPrompt(title: string, questionText: string): ClassroomSyntaxCard[] {
  const text = `${title}\n${questionText}`.toLowerCase()
  if (/\bmatlab\b/.test(text)) return []

  const wantsProgram = mentions(text, /\b(c\+\+|cpp|program|cin|cout|input|output|enter|display|print)\b/)
  const hasNestedIf = mentions(text, /\bnested\b|\bonly if\b|\bfirst check\b|\bthen check\b/)
  const numberedMenu = (text.match(/`\d+`\s*(?:→|->)/g) ?? []).length
  const arrowCount = (text.match(/→|->/g) ?? []).length
  const hasSwitch = mentions(text, /\bswitch\b|\bcase\s+\d/)
  const rangeChain = !hasSwitch && numberedMenu < 2 && arrowCount >= 2
  const hasElseIf = mentions(text, /else\s*-?\s*if/) || rangeChain
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
  if (hasComparison && (hasIf || hasTernary)) selected.add("comparison")
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

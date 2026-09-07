import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionParam = searchParams.get("session");

    if (!sessionParam) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    // Get session ID
    const sessionResult = await sql`
      SELECT id FROM sessions WHERE code = ${sessionParam} LIMIT 1
    `;

    if (sessionResult.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionId = sessionResult[0].id;

    // Get all final exam questions for this session
    const questions = await sql`
      SELECT 
        qq.question_text,
        qq.question_type,
        qq.topic,
        qq.difficulty,
        qq.hint,
        qq.explanation
      FROM quiz_questions qq
      JOIN quizzes q ON qq.quiz_id = q.id
      JOIN quiz_session_access qsa ON q.id = qsa.quiz_id
      WHERE q.assessment_type = 'final'
        AND qsa.session_id = ${sessionId}
        AND qsa.is_active = true
        AND q.deleted_at IS NULL
      ORDER BY qq.topic, qq.difficulty
    `;

    if (questions.length === 0) {
      return NextResponse.json({ 
        success: true,
        studyGuide: {
          totalQuestions: 0,
          topics: [],
          questionTypeBreakdown: {},
          difficultyBreakdown: { easy: 0, medium: 0, hard: 0 }
        }
      });
    }

    // Function to generate detailed study instructions based on topic
    const getDetailedStudyInstructions = (topic: string, questionTypes: string[], difficulty: any): string[] => {
      const instructions: string[] = [];
      const topicLower = topic.toLowerCase().trim();
      
      // Normalize topic name for better matching
      const normalizedTopic = topicLower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
      
      // C++ Core Concepts - expanded matching
      if (normalizedTopic.includes('core concept') || normalizedTopic.includes('c++ core') || 
          normalizedTopic.includes('core') && (normalizedTopic.includes('c++') || normalizedTopic.includes('cpp') || normalizedTopic.includes('programming'))) {
        instructions.push("**Modular Programming - Detailed Explanation**: Modular programming breaks large programs into smaller, independent modules (functions or classes). Each module has a specific purpose and can be developed, tested, and debugged separately. Example: Instead of writing all code in main(), create separate functions like `calculateArea()`, `displayResult()`, `validateInput()`. This improves code reusability, maintainability, and makes debugging easier. Practice: Write a program that calculates the area of different shapes, with each shape calculation in its own function.");
        
        instructions.push("**Functions - Complete Guide**: Functions are reusable blocks of code. Declaration: `int add(int a, int b);` (tells compiler function exists). Definition: `int add(int a, int b) { return a + b; }` (actual implementation). Pass by value copies the argument: `void func(int x) { x = 10; }` won't change original. Pass by reference modifies original: `void func(int &x) { x = 10; }` changes the variable passed. Void functions don't return: `void printHello() { cout << \"Hello\"; }`. Practice: Write functions to swap two numbers (use reference), calculate factorial, and check if a number is prime.");
        
        instructions.push("**Classes and Objects - Comprehensive Understanding**: A class is a blueprint/template. An object is an instance created from that class. Example: `class Car { private: string brand; public: void setBrand(string b) { brand = b; } string getBrand() { return brand; } };` Then create objects: `Car myCar; myCar.setBrand(\"Toyota\");`. Member variables (attributes) store data: `int age;`. Member functions (methods) perform actions: `void display() { }`. Constructors initialize objects: `Car() { brand = \"Unknown\"; }`. Destructors clean up: `~Car() { }`. Practice: Create a Student class with name, ID, and GPA, with methods to set/get values.");
        
        instructions.push("**Identifiers and Naming Rules - Critical Details**: C++ identifiers (variable/function names) have strict rules: (1) Must start with letter (a-z, A-Z) or underscore `_`, NOT a digit. Valid: `myVar`, `_count`, `studentName`. Invalid: `1var`, `my-var`, `while`. (2) Can contain letters, digits, underscores. Valid: `var1`, `total_count`, `MAX_SIZE`. Invalid: `var@name`, `total$`. (3) Cannot be reserved keywords: `if`, `while`, `int`, `class`, `return`, etc. (4) Case-sensitive: `myVar` ≠ `MyVar`. Practice: Identify which are valid: `_data`, `2ndValue`, `my-var`, `class`, `totalCount`, `MAX_SIZE`.");
        
        instructions.push("**Object-Oriented Principles - Deep Dive**: Encapsulation bundles data and methods together, hiding implementation details. Example: A BankAccount class keeps balance private, only accessible through public methods `deposit()` and `withdraw()`. Inheritance allows derived classes to inherit from base classes: `class Animal { }; class Dog : public Animal { };`. Polymorphism means same interface, different behavior: A `Shape` class with `draw()` method, but `Circle` and `Rectangle` implement `draw()` differently. Practice: Create a base `Vehicle` class, then derive `Car` and `Motorcycle` classes with their own implementations.");
      }
      
      // Variables & Constants - expanded matching
      if (normalizedTopic.includes('variable') || normalizedTopic.includes('constant') || 
          normalizedTopic.includes('var') || normalizedTopic.includes('const')) {
        instructions.push("**Variable Declaration - Complete Guide with Examples**: Variables store data in memory. Declaration syntax: `type variableName;` or `type variableName = value;`. Examples: `int age = 25;`, `float price = 19.99;`, `char grade = 'A';`, `bool isActive = true;`. Local variables exist only within their function/block. Global variables are declared outside functions and accessible everywhere. Example: `int globalVar = 10;` (global) vs. `void func() { int localVar = 5; }` (local). Uninitialized variables contain garbage values - always initialize! Practice: Declare variables for a student's name (string), age (int), GPA (float), and enrollment status (bool).");
        
        instructions.push("**Constants - Detailed Explanation with Code**: The `const` keyword creates read-only variables that cannot be modified after initialization. Syntax: `const type NAME = value;`. Example: `const int MAX_STUDENTS = 100;`, `const double PI = 3.14159;`, `const string SCHOOL_NAME = \"University\";`. Constants MUST be initialized at declaration: `const int x;` is ERROR. Use constants for magic numbers: Instead of `if (count > 100)`, use `if (count > MAX_SIZE)`. This improves readability and maintainability. Practice: Create constants for tax rate (0.08), minimum age (18), and maximum attempts (3).");
        
        instructions.push("**Data Types - Comprehensive Reference**: int: stores integers (-2,147,483,648 to 2,147,483,647), example: `int count = 42;`. float: single precision floating-point (7 decimal digits), example: `float temperature = 98.6;`. double: double precision (15 decimal digits), example: `double pi = 3.141592653589793;`. char: single character, example: `char letter = 'A';` (use single quotes). bool: true/false, example: `bool isValid = true;`. Type conversion: Implicit (automatic): `int x = 5; double y = x;` (x becomes 5.0). Explicit (casting): `double d = 9.7; int i = (int)d;` (i becomes 9, truncates). Practice: Convert a float to int, an int to double, and a char to int (ASCII value).");
        
        instructions.push("**Variable Naming - Best Practices with Examples**: Good names: `studentCount`, `totalPrice`, `isValid`, `maxSize`. Bad names: `x`, `temp`, `data`, `a1`. Use camelCase: `firstName`, `lastName`, `totalAmount`. Or snake_case: `first_name`, `last_name`, `total_amount`. Avoid: starting with numbers (`2ndValue`), special characters (`my-var`), reserved keywords (`int`, `class`, `return`). Constants often use UPPER_CASE: `MAX_SIZE`, `MIN_AGE`. Practice: Rename these: `int x = 10;` → `int studentCount = 10;`, `float t = 98.6;` → `float temperature = 98.6;`.");
      }
      
      // Data Types - expanded matching
      if ((normalizedTopic.includes('data type') || normalizedTopic.includes('datatype') || normalizedTopic.includes('type')) && 
          !normalizedTopic.includes('variable') && !normalizedTopic.includes('var')) {
        instructions.push("**Primitive Data Types**: Master int (integers), float/double (floating-point), char (characters), bool (boolean true/false), and their size ranges.");
        instructions.push("**Type Modifiers**: Understand signed/unsigned, short/long modifiers and their impact on value ranges (e.g., `unsigned int` can only hold non-negative values).");
        instructions.push("**Type Conversion**: Learn implicit conversion (automatic) and explicit casting using `(type)` or `static_cast<type>()`. Practice converting between int, float, and char.");
        instructions.push("**MATLAB Data Types**: If applicable, understand MATLAB's numeric types (double, single, int8, int16, etc.), logical (true/false), char arrays, and cell arrays.");
      }
      
      // Input/Output - expanded matching
      if (normalizedTopic.includes('input') || normalizedTopic.includes('output') || 
          normalizedTopic.includes('i/o') || normalizedTopic.includes('io') || 
          normalizedTopic.includes('cin') || normalizedTopic.includes('cout') ||
          (normalizedTopic.includes('stream') && !normalizedTopic.includes('string'))) {
        instructions.push("**C++ I/O Streams - Complete Setup**: Always start with: `#include <iostream>` and `using namespace std;` (or use `std::cin`/`std::cout`). `cin` reads from keyboard, `cout` writes to screen. Full example: `#include <iostream>` `using namespace std;` `int main() { int x; cin >> x; cout << x; return 0; }`. Without `using namespace std;`, use: `std::cin >> x; std::cout << x;`. Practice: Write a program that reads two numbers and prints their sum.");
        
        instructions.push("**Input Operations - Detailed Examples**: `cin >> variable` reads one value, skipping whitespace. Example: `int age; cin >> age;` reads an integer. Multiple inputs: `int a, b; cin >> a >> b;` reads two integers separated by space. String input: `string name; cin >> name;` reads until whitespace (stops at space). To read entire line: `string line; getline(cin, line);` reads including spaces. Important: After `cin >>`, if you use `getline()`, you may need `cin.ignore()` to clear the newline. Example: `int n; cin >> n; cin.ignore(); string s; getline(cin, s);`. Practice: Read a number, then read a full name (with spaces).");
        
        instructions.push("**Output Operations - Formatting Guide**: Basic: `cout << value;` prints value. Chaining: `cout << \"Age: \" << age << \" years\";` outputs: \"Age: 25 years\". Newlines: `cout << \"Line 1\" << endl << \"Line 2\";` or `cout << \"Line 1\\nLine 2\";`. Both create new lines. Formatting numbers: `cout << fixed << setprecision(2) << price;` (need `#include <iomanip>`) shows 2 decimals. Example: `double p = 19.999; cout << fixed << setprecision(2) << p;` outputs \"20.00\". Practice: Print formatted output: \"Student: John, Age: 20, GPA: 3.75\" on separate lines.");
        
        instructions.push("**MATLAB I/O - Comprehensive Guide**: Input: `x = input('Enter a number: ');` prompts and reads number. String input: `name = input('Enter name: ', 's');` reads string. Output: `disp('Hello');` displays text. Formatted: `fprintf('Value: %d, Price: %.2f\\n', count, price);` where %d = integer, %f = float, %.2f = 2 decimals. File I/O: Open: `fid = fopen('data.txt', 'r');` (r=read, w=write, a=append). Read: `data = fscanf(fid, '%f', [1, 10]);` reads 10 floats. Write: `fprintf(fid, '%d %f\\n', x, y);`. Close: `fclose(fid);`. Always check: `if fid == -1, error('File not found'); end`. Practice: Read numbers from file, calculate average, write result to new file.");
      }
      
      // Loops - expanded matching
      if (normalizedTopic.includes('loop') || normalizedTopic.includes('iteration') || normalizedTopic.includes('for') || normalizedTopic.includes('while')) {
        instructions.push("**For Loops - Complete Syntax with Examples**: Syntax: `for (init; condition; increment) { statements; }`. Example: `for (int i = 0; i < 5; i++) { cout << i << \" \"; }` outputs: \"0 1 2 3 4 \". Execution: (1) Initialize: `int i = 0`, (2) Check condition: `i < 5` (true), (3) Execute body, (4) Increment: `i++`, (5) Repeat from step 2. Countdown: `for (int i = 10; i >= 1; i--) { cout << i; }` outputs: \"10987654321\". Step by 2: `for (int i = 0; i < 10; i += 2) { cout << i; }` outputs: \"02468\". Practice: Print numbers 1 to 100, sum numbers 1 to 50, print even numbers 2 to 20.");
        
        instructions.push("**While Loops - Detailed Guide**: Syntax: `while (condition) { statements; }`. Example: `int i = 0; while (i < 5) { cout << i; i++; }` outputs: \"01234\". Pre-test: Condition checked BEFORE execution (may not execute). Do-while: `do { statements; } while (condition);` - executes AT LEAST ONCE, condition checked AFTER. Example: `int x; do { cin >> x; } while (x < 0);` ensures positive input. Infinite loop: `while (true) { }` or `while (1) { }` - use `break` to exit. Common mistake: Forgetting increment causes infinite loop: `int i = 0; while (i < 5) { cout << i; }` (missing `i++`). Practice: Read numbers until user enters 0, count how many positive numbers entered.");
        
        instructions.push("**Nested Loops - Pattern Printing Examples**: Outer loop controls rows, inner loop controls columns. Example - rectangle: `for (int i = 0; i < 3; i++) { for (int j = 0; j < 4; j++) { cout << \"*\"; } cout << endl; }` prints 3x4 rectangle. Example - triangle: `for (int i = 1; i <= 5; i++) { for (int j = 1; j <= i; j++) { cout << \"*\"; } cout << endl; }` prints increasing stars. 2D array traversal: `for (int i = 0; i < rows; i++) { for (int j = 0; j < cols; j++) { cout << matrix[i][j] << \" \"; } cout << endl; }`. Inner loop completes ALL iterations before outer increments. Practice: Print multiplication table (1x1 to 10x10), print pyramid pattern.");
        
        instructions.push("**Loop Control - Break and Continue**: `break` exits loop immediately, skipping remaining iterations. Example: `for (int i = 0; i < 10; i++) { if (i == 5) break; cout << i; }` outputs: \"01234\" (stops at 5). `continue` skips to next iteration, skipping rest of current iteration. Example: `for (int i = 0; i < 10; i++) { if (i % 2 == 0) continue; cout << i; }` outputs: \"13579\" (skips evens). Use break to exit early when condition met. Use continue to skip certain values. Practice: Print numbers 1-20, but skip multiples of 3. Find first number > 100 in array, then break.");
        
        instructions.push("**MATLAB Loops - Syntax and Vectorization**: For loop: `for i = 1:10, disp(i); end` or `for i = 1:10` `    disp(i);` `end`. While: `while condition, statements; end`. Vectorized (faster): Instead of `for i = 1:length(arr), sum = sum + arr(i); end`, use `sum(arr)`. Instead of `for i = 1:10, squares(i) = i^2; end`, use `squares = (1:10).^2`. Colon operator: `1:5` creates `[1 2 3 4 5]`, `1:2:10` creates `[1 3 5 7 9]` (step 2). Practice: Create array 1 to 100, find sum using loop and using `sum()`, create squares 1^2 to 10^2 using vectorization.");
      }
      
      // Functions - expanded matching
      if ((normalizedTopic.includes('function') || normalizedTopic.includes('method')) && !normalizedTopic.includes('member')) {
        instructions.push("**Function Declaration vs. Definition - Complete Guide**: Declaration (prototype) tells compiler function exists: `int add(int a, int b);` (ends with semicolon, no body). Definition has actual code: `int add(int a, int b) { return a + b; }` (has body in braces). Declaration can appear before main(), definition after. Example: `int multiply(int, int);` (declaration, parameter names optional) then later `int multiply(int x, int y) { return x * y; }` (definition). Why use declarations? Allows calling function before it's defined. Practice: Write declaration for function that takes two floats and returns their product, then write definition.");
        
        instructions.push("**Function Parameters - Pass by Value vs. Reference**: Pass by value (default): Function gets COPY of argument. Changes inside function don't affect original. Example: `void change(int x) { x = 10; }` then `int a = 5; change(a); cout << a;` outputs 5 (unchanged). Pass by reference (use `&`): Function accesses ORIGINAL variable. Changes affect original. Example: `void change(int &x) { x = 10; }` then `int a = 5; change(a); cout << a;` outputs 10 (changed). Use reference when: (1) Need to modify original, (2) Passing large objects (efficiency), (3) Need multiple return values. Example - swap: `void swap(int &a, int &b) { int temp = a; a = b; b = temp; }`. Practice: Write function that takes reference to int and doubles it.");
        
        instructions.push("**Return Types - Detailed Examples**: Returning value: `int getMax(int a, int b) { if (a > b) return a; else return b; }`. Must return value matching type. Multiple returns: `int sign(int x) { if (x > 0) return 1; else if (x < 0) return -1; else return 0; }`. Void functions: `void printHello() { cout << \"Hello\"; }` - no return statement needed, or use `return;` to exit early. Return in void: `void check(int x) { if (x < 0) return; cout << x; }` exits if negative. Common error: Forgetting return in non-void function causes undefined behavior. Practice: Write function that returns absolute value, function that returns true if number is even, void function that prints square of number.");
        
        instructions.push("**Function Overloading - Multiple Functions Same Name**: C++ allows multiple functions with same name but different parameters. Compiler selects based on argument types/count. Example: `int add(int a, int b) { return a + b; }` and `double add(double a, double b) { return a + b; }` and `int add(int a, int b, int c) { return a + b + c; }`. When calling: `add(5, 3)` uses first, `add(5.5, 3.2)` uses second, `add(1, 2, 3)` uses third. Must differ in: number of parameters OR types (not just return type). Invalid: `int func(int x);` and `double func(int x);` (same parameters). Practice: Overload function to calculate area - one for circle (radius), one for rectangle (length, width).");
        
        instructions.push("**MATLAB Functions - Syntax and Usage**: Function file: Create file `myFunction.m` with: `function [output1, output2] = myFunction(input1, input2)` `    output1 = input1 + input2;` `    output2 = input1 * input2;` `end`. Call: `[sum, product] = myFunction(5, 3);`. Single output: `function result = square(x), result = x^2; end`. No output: `function printHello(name), fprintf('Hello %s\\n', name); end`. Local variables: Variables inside function are local (not visible outside). Global: `global varName;` makes variable global. Script vs. function: Scripts run directly, functions must be called. Practice: Write function that takes array and returns mean and standard deviation, function that takes two matrices and returns their product.");
      }
      
      // Arrays - expanded matching
      if (normalizedTopic.includes('array') || normalizedTopic.includes('vector') || normalizedTopic.includes('matrix') || normalizedTopic.includes('list')) {
        instructions.push("**Array Declaration - Syntax and Examples**: Syntax: `type arrayName[size];`. Example: `int numbers[10];` creates array of 10 integers. Indices start at 0, so valid indices are 0 to 9. Access: `numbers[0]` is first element, `numbers[9]` is last. Size must be constant: `int size = 10; int arr[size];` may cause error (use `const int size = 10;`). Array name is pointer to first element: `numbers` is same as `&numbers[0]`. Practice: Declare array of 5 floats, array of 20 characters, array of 100 integers.");
        
        instructions.push("**Array Access and Bounds - Critical Details**: Access: `arr[index]` gets/sets element. Example: `int arr[5] = {10, 20, 30, 40, 50};` then `arr[0] = 100;` changes first to 100. Valid indices: 0 to size-1. Out of bounds: `arr[5]` when size is 5 causes UNDEFINED BEHAVIOR (may crash, may read garbage). Always check bounds: `if (index >= 0 && index < size) { arr[index] = value; }`. Common error: Using `arr[size]` (last valid is `arr[size-1]`). Loop through array: `for (int i = 0; i < size; i++) { cout << arr[i]; }`. Practice: Write function to find maximum value in array, check if value exists in array.");
        
        instructions.push("**Array Initialization - All Methods**: Method 1 - Full: `int arr[5] = {1, 2, 3, 4, 5};` initializes all. Method 2 - Partial: `int arr[5] = {1, 2};` initializes first two, rest are 0. Method 3 - All zeros: `int arr[5] = {0};` sets all to 0. Method 4 - No size: `int arr[] = {1, 2, 3};` size is 3 (auto-determined). Method 5 - Uninitialized: `int arr[5];` contains garbage values. Character array: `char str[10] = \"Hello\";` (size 10, holds \"Hello\\0\"). Practice: Initialize array with first 10 even numbers, initialize 2D array 3x3 with values 1-9.");
        
        instructions.push("**Multidimensional Arrays - 2D Arrays Guide**: Declaration: `type arrayName[rows][cols];`. Example: `int matrix[3][4];` is 3 rows, 4 columns. Initialization: `int matrix[2][3] = {{1,2,3}, {4,5,6}};` or `int matrix[2][3] = {1,2,3,4,5,6};` (row-major order). Access: `matrix[row][col]` - row and col both start at 0. Traversal: `for (int i = 0; i < rows; i++) { for (int j = 0; j < cols; j++) { cout << matrix[i][j] << \" \"; } cout << endl; }`. Row-major storage: Elements stored row by row in memory. Practice: Create 3x3 identity matrix (1s on diagonal, 0s elsewhere), find sum of each row, transpose matrix (swap rows/columns).");
        
        instructions.push("**MATLAB Arrays/Matrices - Complete Reference**: Creation: `A = [1 2 3; 4 5 6]` creates 2x3 matrix. Row separator: semicolon `;`. Column separator: space or comma. Indexing: `A(1,2)` gets row 1, col 2 (1-based, not 0-based!). `A(1,:)` gets entire row 1, `A(:,2)` gets entire column 2. Colon operator: `1:5` creates `[1 2 3 4 5]`, `1:2:10` creates `[1 3 5 7 9]`. Element-wise: `A .* B` multiplies element by element. Matrix multiplication: `A * B` does matrix math. Functions: `size(A)` returns `[rows cols]`, `length(A)` returns max dimension, `reshape(A, 2, 3)` reshapes. Practice: Create 5x5 matrix, extract diagonal, find row sums, multiply two matrices.");
      }
      
      // Pointers - expanded matching
      if (normalizedTopic.includes('pointer') || normalizedTopic.includes('reference') || normalizedTopic.includes('address') || normalizedTopic.includes('memory')) {
        instructions.push("**Pointer Basics**: Understand that pointers store memory addresses. Learn declaration: `int* ptr;` or `int *ptr;` and address-of operator: `ptr = &variable;`");
        instructions.push("**Dereferencing**: Master the dereference operator `*ptr` to access the value at the address. Understand the difference between `ptr` (address) and `*ptr` (value).");
        instructions.push("**Pointer Arithmetic**: Learn how adding/subtracting integers to pointers moves by the size of the pointed type. Practice: `ptr++` moves to next element in array.");
        instructions.push("**Pointers and Arrays**: Understand that array names are essentially pointers to the first element. Learn `arr[i]` is equivalent to `*(arr + i)`.");
        instructions.push("**Null Pointers**: Always initialize pointers. Use `nullptr` (C++11+) or `NULL` to represent 'no address'. Never dereference null pointers.");
      }
      
      // Classes - expanded matching
      if (normalizedTopic.includes('class') || normalizedTopic.includes('object') || normalizedTopic.includes('oop') || normalizedTopic.includes('encapsulation') || normalizedTopic.includes('inheritance')) {
        instructions.push("**Class Syntax**: Master the basic structure: `class ClassName { private: ... public: ... };`. Understand access specifiers: private (only class can access), public (anyone can access), protected (derived classes).");
        instructions.push("**Constructors and Destructors**: Learn constructor syntax `ClassName()` for initialization and destructor `~ClassName()` for cleanup. Understand default, parameterized, and copy constructors.");
        instructions.push("**Member Variables and Functions**: Practice declaring member variables (attributes) and member functions (methods). Understand the difference between instance members and static members.");
        instructions.push("**Encapsulation**: Understand data hiding - make member variables private and provide public getter/setter functions to control access.");
        instructions.push("**Object Creation**: Learn to create objects: `ClassName obj;` or `ClassName obj(parameters);`. Understand that objects are instances of classes.");
      }
      
      // Debugging - expanded matching
      if (normalizedTopic.includes('debug') || normalizedTopic.includes('error') || normalizedTopic.includes('fix') || normalizedTopic.includes('troubleshoot')) {
        instructions.push("**Common Syntax Errors**: Missing semicolons, unmatched braces `{}`, missing `#include` directives, undefined variables, type mismatches.");
        instructions.push("**Compilation Errors**: Learn to read compiler error messages. Common issues: undefined references (missing function definitions), multiple definitions (include guards needed), type errors.");
        instructions.push("**Runtime Errors**: Understand segmentation faults (accessing invalid memory), division by zero, array out of bounds, null pointer dereference.");
        instructions.push("**Debugging Techniques**: Use print statements (`cout`) to trace execution, check variable values at different points, verify loop conditions and array indices.");
        instructions.push("**MATLAB Debugging**: If applicable, learn to use `dbstop`, `dbcont`, `dbstep`, breakpoints in MATLAB Editor, and understand common errors like dimension mismatches.");
      }
      
      // Control Structures - expanded matching
      if (normalizedTopic.includes('control') || normalizedTopic.includes('if') || normalizedTopic.includes('switch') || normalizedTopic.includes('conditional') || normalizedTopic.includes('decision') || normalizedTopic.includes('branch')) {
        instructions.push("**If-Else Statements - Complete Syntax Guide**: Basic: `if (condition) { statements; }`. If-else: `if (condition) { statements1; } else { statements2; }`. If-else-if: `if (x > 0) { cout << \"positive\"; } else if (x < 0) { cout << \"negative\"; } else { cout << \"zero\"; }`. Relational: `==` (equal), `!=` (not equal), `<` (less), `>` (greater), `<=` (less/equal), `>=` (greater/equal). Logical: `&&` (AND - both true), `||` (OR - either true), `!` (NOT - reverses). Examples: `if (age >= 18 && age <= 65)`, `if (grade == 'A' || grade == 'B')`, `if (!isValid)`. Common error: Using `=` instead of `==` for comparison. Practice: Write code to determine grade letter (A if >=90, B if >=80, etc.), check if year is leap year.");
        
        instructions.push("**Nested Conditionals - Complex Logic Examples**: Nested if: `if (x > 0) { if (x < 10) { cout << \"small positive\"; } }`. If-else-if chain: `if (score >= 90) grade = 'A'; else if (score >= 80) grade = 'B'; else if (score >= 70) grade = 'C'; else grade = 'F';`. Combining conditions: `if ((age >= 18 && age <= 65) && (hasLicense || hasPermit)) { allow(); }`. Short-circuit: With `&&`, if first is false, second not evaluated. With `||`, if first is true, second not evaluated. Example: `if (x != 0 && y/x > 5)` - safe because if x==0, y/x not evaluated. Use parentheses for clarity: `if ((a || b) && (c || d))`. Practice: Write nested conditions to check: student is eligible if (age >= 18 AND GPA >= 2.0) OR (age >= 16 AND GPA >= 3.5).");
        
        instructions.push("**Switch Statements - Complete Guide with Examples**: Syntax: `switch (variable) { case value1: statements1; break; case value2: statements2; break; default: statements; }`. Example: `switch (grade) { case 'A': cout << \"Excellent\"; break; case 'B': cout << \"Good\"; break; case 'C': cout << \"Average\"; break; default: cout << \"Fail\"; }`. Break is CRITICAL: Without break, execution falls through to next case (usually unwanted). Example - missing break: `switch (x) { case 1: cout << \"one\"; case 2: cout << \"two\"; }` - if x==1, outputs \"onetwo\". Default case: Executes if no case matches. Can be anywhere. Switch works with: int, char, enum. Does NOT work with: float, string (use if-else). Practice: Convert if-else chain to switch for day of week (1=Monday, etc.), use switch for menu selection.");
        
        instructions.push("**Boolean Logic - Truth Tables and Examples**: AND (`&&`): true && true = true, true && false = false, false && true = false, false && false = false. OR (`||`): true || true = true, true || false = true, false || true = true, false || false = false. NOT (`!`): !true = false, !false = true. Examples: `(x > 0 && x < 10)` - x between 0 and 10. `(age < 18 || age > 65)` - age outside 18-65. `!(x == 0)` same as `x != 0`. Precedence: `!` highest, then `&&`, then `||`. Use parentheses: `(a || b) && c` is different from `a || (b && c)`. De Morgan's laws: `!(a && b)` = `!a || !b`, `!(a || b)` = `!a && !b`. Practice: Simplify: `!(x < 5 || x > 10)`, evaluate: `(true && false) || true`, write condition: x is not between 5 and 10.");
      }
      
      // MATLAB Specific - expanded matching
      if (normalizedTopic.includes('matlab') || normalizedTopic.includes('matrix lab')) {
        instructions.push("**MATLAB Basics**: Understand MATLAB as an interpreted language. Learn workspace, command window, script files (.m), and function files.");
        instructions.push("**MATLAB Arrays/Matrices**: Master matrix creation, indexing (1-based, not 0-based like C++), colon operator `:`, and array operations (element-wise `.*`, `./` vs. matrix `*`, `/`).");
        instructions.push("**MATLAB Functions**: Learn built-in functions (`sin`, `cos`, `sqrt`, `max`, `min`, `sum`, `mean`) and how to create custom functions. Understand function handles.");
        instructions.push("**MATLAB Plotting**: Practice `plot()`, `subplot()`, `xlabel()`, `ylabel()`, `title()`, `legend()` for data visualization.");
        instructions.push("**MATLAB File I/O**: Learn `load()`, `save()`, `fopen()`, `fscanf()`, `fprintf()`, `fclose()` for reading and writing data files.");
      }
      
      // Operators - expanded matching
      if (normalizedTopic.includes('operator') || normalizedTopic.includes('arithmetic') || normalizedTopic.includes('math') || normalizedTopic.includes('calculation')) {
        instructions.push("**Arithmetic Operators**: Master `+`, `-`, `*`, `/`, `%` (modulus). Understand integer division vs. floating-point division. Practice operator precedence.");
        instructions.push("**Assignment Operators**: Learn `=`, `+=`, `-=`, `*=`, `/=`, `%=`. Understand that `a += b` is equivalent to `a = a + b`.");
        instructions.push("**Increment/Decrement**: Master `++` and `--` operators. Understand prefix (`++x`) vs. postfix (`x++`) and when each is used.");
        instructions.push("**Relational and Logical**: Practice `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`. Understand that these return boolean values (true/false).");
      }
      
      // Strings - expanded matching
      if (normalizedTopic.includes('string') || normalizedTopic.includes('char') || normalizedTopic.includes('text') || normalizedTopic.includes('character')) {
        instructions.push("**C++ Strings**: Learn `std::string` class (include `<string>`). Master string operations: concatenation (`+`), length (`length()` or `size()`), accessing characters (`str[i]`).");
        instructions.push("**C-Strings**: Understand character arrays ending with `\\0`. Learn functions like `strlen()`, `strcpy()`, `strcat()` (include `<cstring>`). Know the difference between C-strings and C++ strings.");
        instructions.push("**String Input/Output**: Practice reading strings with `cin >> str` (stops at whitespace) vs. `getline(cin, str)` (reads entire line including spaces).");
        instructions.push("**MATLAB Strings**: If applicable, learn character arrays and string arrays, `strcat()`, `strcmp()`, string indexing, and conversion functions.");
      }
      
      // File I/O - expanded matching
      if (normalizedTopic.includes('file') && (normalizedTopic.includes('i/o') || normalizedTopic.includes('io') || normalizedTopic.includes('input') || normalizedTopic.includes('output') || normalizedTopic.includes('read') || normalizedTopic.includes('write'))) {
        instructions.push("**C++ File Operations**: Master file streams: `#include <fstream>`, `ifstream` for input, `ofstream` for output. Learn `file.open()`, `file.close()`, and checking `file.is_open()`.");
        instructions.push("**Reading Files**: Practice reading with `file >> variable` or `getline(file, line)`. Understand end-of-file detection and proper file closing.");
        instructions.push("**Writing Files**: Learn to write with `file << data`. Understand append mode vs. overwrite mode when opening files.");
        instructions.push("**Error Handling**: Always check if file operations succeed. Use `if (file.fail())` or `if (!file)` to detect errors.");
      }
      
      // If no specific topic matches, provide detailed instructions based on topic name
      if (instructions.length === 0) {
        // Try to extract key concepts from topic name and provide relevant instructions
        const topicWords = topicLower.split(/[\s\-_]+/).filter(w => w.length > 0);
        
        // Check for programming language mentions
        const isCpp = topicWords.some(w => w.includes('c++') || w.includes('cpp') || w === 'c' || normalizedTopic.includes('c++'));
        const isMatlab = topicWords.some(w => w.includes('matlab') || normalizedTopic.includes('matlab'));
        
        // Always provide comprehensive instructions - never return empty
        instructions.push(`**Understanding ${topic} - Comprehensive Study Guide**: This topic is an important part of your final exam. Start by creating a study plan: (1) Review all lecture materials, slides, notes, and textbook sections related to ${topic}. (2) Make flashcards or summary sheets with key definitions, syntax rules, and examples. 3) Practice writing code examples from scratch - don't just read them. 4) Work through all practice problems and homework assignments related to this topic.`);
        
        instructions.push(`**${topic} - Syntax, Rules, and Code Examples**: Master the syntax and rules for ${topic}. Write at least 5-10 different code examples demonstrating various aspects of this concept. For each example: (a) Write the code, (b) Trace through execution manually, (c) Predict the output, (d) Test it in a compiler/interpreter, (e) Compare your prediction with actual output. ${isCpp ? 'C++ Syntax Tips: Always include necessary headers (\`#include <iostream>\`, \`<string>\`, etc.), use semicolons to end statements, match all braces \`{}\`, and use proper variable types. Example structure: \`#include <iostream>\` \`using namespace std;\` \`int main() { /* code */ return 0; }\`' : ''} ${isMatlab ? 'MATLAB Syntax Tips: Remember 1-based indexing (first element is at index 1, not 0), use semicolons to suppress output, and understand matrix vs. element-wise operations. Example: \`A = [1 2 3; 4 5 6];\` creates 2x3 matrix, \`A(1,2)\` accesses row 1, column 2.' : ''}`);
        
        instructions.push(`**${topic} - Common Mistakes and How to Avoid Them**: Identify and learn from common errors. Typical mistakes include: (1) Syntax errors: missing semicolons, unmatched braces/parentheses, wrong header includes, incorrect variable declarations. (2) Logic errors: wrong conditions in if/while statements, incorrect loop bounds, off-by-one errors in arrays. (3) Conceptual errors: misunderstanding how the feature works, using wrong data types, incorrect operator usage. Practice: Find and fix errors in sample code. Write code with intentional errors, then debug them.`);
        
        instructions.push(`**${topic} - Step-by-Step Problem Solving**: When solving problems involving ${topic}, follow this approach: (1) Read and understand the problem completely. (2) Identify what concepts from ${topic} are needed. (3) Plan your solution (pseudocode or outline). (4) Write the code step by step. (5) Test with sample inputs. (6) Debug if needed. (7) Verify edge cases. Practice this process with 10-15 problems related to ${topic}.`);
        
        instructions.push(`**${topic} - Code Tracing and Execution Flow**: Master tracing through code execution. For any code involving ${topic}, manually trace: (1) Variable declarations and initial values. (2) Each statement execution in order. (3) How variable values change after each operation. (4) Control flow (which if/else branches execute, how many loop iterations occur). (5) Final output. Create a table: Column 1 = Line number, Column 2 = Code, Column 3 = Variable values after execution, Column 4 = Output. Practice with 5-10 code examples.`);
        
        if (questionTypes.some(t => t.includes('code') || t.includes('debug') || t.includes('output') || t.includes('fill'))) {
          instructions.push(`**${topic} - Complete Coding Practice**: Since this topic includes coding questions, practice writing full, working programs. Structure: ${isCpp ? 'Include necessary headers, use namespace, write main function with proper return statement.' : isMatlab ? 'Create function files or scripts with proper syntax, handle inputs/outputs correctly.' : 'Follow proper program structure for your language.'} Test with: (1) Normal cases (typical inputs), (2) Edge cases (boundary values, empty inputs, maximum values), (3) Invalid inputs (negative numbers when expecting positive, wrong types). Learn to handle errors and validate input.`);
        }
        
        // Add language-specific comprehensive advice
        if (isCpp || !isMatlab) {
          instructions.push(`**C++ Programming Fundamentals for ${topic}**: Essential C++ knowledge: (1) Data types: \`int\`, \`float\`, \`double\`, \`char\`, \`bool\`, \`string\`. (2) I/O: \`cin >> var;\` for input, \`cout << value;\` for output, \`getline(cin, str);\` for full line input. (3) Control: \`if/else\`, \`switch\`, \`for\`, \`while\`, \`do-while\`. (4) Functions: declaration, definition, parameters (value vs. reference with \`&\`), return types. (5) Arrays: declaration \`type arr[size];\`, indexing starts at 0, bounds checking. (6) Classes: syntax, constructors, member variables/functions, access specifiers (private/public). Practice compiling code frequently to catch errors early.`);
        }
        
        if (isMatlab) {
          instructions.push(`**MATLAB Programming Fundamentals for ${topic}**: Essential MATLAB knowledge: (1) Arrays/Matrices: Creation \`A = [1 2 3; 4 5 6]\`, indexing \`A(1,2)\` (1-based!), colon operator \`1:5\` creates \`[1 2 3 4 5]\`. (2) Operations: Element-wise \`.*\`, \`./\`, \`.^\` vs. matrix \`*\`, \`/\`, \`^\`. (3) Functions: Built-in (\`sin\`, \`cos\`, \`sqrt\`, \`max\`, \`min\`, \`sum\`, \`mean\`) and custom functions. (4) Control: \`if/elseif/else/end\`, \`for i = 1:n/end\`, \`while condition/end\`. (5) I/O: \`input()\`, \`fprintf()\`, \`disp()\`, file operations. (6) Vectorization: Replace loops with array operations when possible for efficiency. Practice in MATLAB command window and create .m script files.`);
        }
        
        // Add difficulty-specific comprehensive advice
        if (difficulty.hard > 0) {
          instructions.push(`**Advanced ${topic} - Challenging Concepts**: This topic includes difficult questions requiring deep understanding. Focus on: (1) Underlying principles and theory - not just memorization. (2) Edge cases and boundary conditions - what happens at limits? (3) Combining multiple concepts - how does ${topic} interact with other programming concepts? (4) Optimization and efficiency - can you solve it more elegantly? (5) Problem decomposition - break complex problems into smaller parts. Practice: Solve challenging problems, analyze multiple solution approaches, understand trade-offs between different methods.`);
        } else if (difficulty.medium > 0) {
          instructions.push(`**${topic} - Intermediate Level Practice**: This topic includes medium-difficulty questions. Focus on: (1) Applying concepts correctly in various scenarios. (2) Understanding nuances and details. (3) Combining basic concepts. (4) Debugging common issues. Practice with progressively harder problems.`);
        }
        
        // Always add practice recommendation
        instructions.push(`**${topic} - Final Preparation Checklist**: Before the exam, ensure you can: ✓ Explain ${topic} concepts in your own words. ✓ Write code examples from memory. ✓ Identify and fix errors in code. ✓ Trace through code execution step-by-step. ✓ Solve new problems using ${topic}. ✓ Distinguish between correct and incorrect usage. Create a practice test: Write 5-10 questions covering different aspects of ${topic}, solve them, then check your answers.`);
      }
      
      // Add difficulty-specific advice
      if (difficulty.hard > 0) {
        instructions.push("**Advanced Concepts**: This topic includes hard questions. Focus on deeper understanding, edge cases, and complex problem-solving. Practice challenging problems.");
      }
      
      return instructions;
    };

    // Analyze questions and create study guide
    const topicsMap = new Map<string, any>();
    const questionTypeBreakdown: { [key: string]: number } = {};
    const difficultyBreakdown = { easy: 0, medium: 0, hard: 0 };

    questions.forEach((q: any) => {
      const topic = q.topic || "General Topics";
      
      // Initialize topic if not exists
      if (!topicsMap.has(topic)) {
        topicsMap.set(topic, {
          name: topic,
          questionCount: 0,
          difficulty: { easy: 0, medium: 0, hard: 0 },
          questionTypes: {},
          sampleQuestions: []
        });
      }

      const topicData = topicsMap.get(topic)!;
      topicData.questionCount++;
      
      // Track difficulty
      const difficulty = (q.difficulty || "medium").toLowerCase();
      if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
        topicData.difficulty[difficulty]++;
        difficultyBreakdown[difficulty]++;
      } else {
        // Default to medium if invalid
        topicData.difficulty.medium++;
        difficultyBreakdown.medium++;
      }

      // Track question types
      const qType = q.question_type || "mcq";
      topicData.questionTypes[qType] = (topicData.questionTypes[qType] || 0) + 1;
      questionTypeBreakdown[qType] = (questionTypeBreakdown[qType] || 0) + 1;

      // Store sample questions (first 3 per topic)
      if (topicData.sampleQuestions.length < 3 && q.question_text) {
        const questionPreview = q.question_text.length > 150 
          ? q.question_text.substring(0, 150) + "..." 
          : q.question_text;
        topicData.sampleQuestions.push(questionPreview);
      }
    });

    // Add detailed study instructions to each topic
    topicsMap.forEach((topicData, topicName) => {
      topicData.detailedInstructions = getDetailedStudyInstructions(
        topicName,
        Object.keys(topicData.questionTypes),
        topicData.difficulty
      );
    });

    const studyGuide = {
      totalQuestions: questions.length,
      topics: Array.from(topicsMap.values()),
      questionTypeBreakdown,
      difficultyBreakdown
    };

    return NextResponse.json({ 
      success: true,
      studyGuide 
    });

  } catch (error) {
    console.error("[Study Guide] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate study guide", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


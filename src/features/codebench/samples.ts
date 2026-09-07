export const DEFAULT_INTERACTIVE_SAMPLE = `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int age;

    cout << "Enter your name: ";
    cin >> name;

    cout << "Enter your age: ";
    cin >> age;

    cout << "Hello " << name
         << "! You are "
         << age
         << " years old."
         << endl;

    return 0;
}
`

export const CODEBENCH_TEST_PROGRAMS = [
  {
    id: 'hello',
    label: 'TEST 1 — Simple output',
    source: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello CourseCollab!" << endl;
    return 0;
}
`,
  },
  {
    id: 'single-cin',
    label: 'TEST 2 — Single cin',
    source: `#include <iostream>
using namespace std;

int main() {
    int number;
    cout << "Enter number: ";
    cin >> number;
    cout << number * 2 << endl;
    return 0;
}
`,
  },
  {
    id: 'multi-cin',
    label: 'TEST 3 — Multiple cin',
    source: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int age;
    cout << "Name: ";
    cin >> name;
    cout << "Age: ";
    cin >> age;
    cout << name << " " << age << endl;
    return 0;
}
`,
  },
  {
    id: 'looped-input',
    label: 'TEST 4 — Looped input',
    source: `#include <iostream>
using namespace std;

int main() {
    int value;
    while (cin >> value) {
        cout << "Received: " << value << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'compiler-error',
    label: 'TEST 5 — Compiler error',
    source: `#include <iostream>
using namespace std;

int main() {
    cout << "Missing semicolon"
    return 0;
}
`,
  },
  {
    id: 'runtime-failure',
    label: 'TEST 6 — Runtime failure',
    source: `#include <cstdlib>

int main() {
    abort();
}
`,
  },
  {
    id: 'infinite-loop',
    label: 'TEST 7 — Infinite loop',
    source: `int main() {
    while (true) {}
    return 0;
}
`,
  },
  {
    id: 'excessive-output',
    label: 'TEST 8 — Excessive output',
    source: `#include <iostream>
using namespace std;

int main() {
    while (true) {
        cout << "CourseCollab" << endl;
    }
}
`,
  },
] as const

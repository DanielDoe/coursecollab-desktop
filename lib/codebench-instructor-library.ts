import type { CodebenchLanguageId } from "@/lib/codebench-languages"
import { instructorCodebenchOwnerKey } from "@/lib/codebench-instructor-scope"

export const INSTRUCTOR_LIBRARY_CATEGORIES = [
  "examples",
  "demonstrations",
  "starter_code",
  "solutions",
  "challenges",
  "templates",
  "algorithms",
  "debugging",
] as const

export type InstructorLibraryCategory = (typeof INSTRUCTOR_LIBRARY_CATEGORIES)[number]

export const INSTRUCTOR_LIBRARY_CATEGORY_LABELS: Record<InstructorLibraryCategory, string> = {
  examples: "Examples",
  demonstrations: "Demonstrations",
  starter_code: "Starter Code",
  solutions: "Solutions",
  challenges: "Challenges",
  templates: "Templates",
  algorithms: "Algorithms",
  debugging: "Debugging Examples",
}

export type InstructorLibraryItem = {
  id: string
  title: string
  category: InstructorLibraryCategory
  languageId: CodebenchLanguageId
  topic: string
  week?: string
  difficulty?: "beginner" | "intermediate" | "advanced"
  tags: string[]
  description: string
  files: Array<{ path: string; content: string }>
  courseId?: number | null
  createdAt: number
  updatedAt: number
}

export type InstructorLibraryStore = {
  version: 1
  items: InstructorLibraryItem[]
}

const STORAGE_SUFFIX = "codebench_instructor_library_v1"

function storageKey(ownerKey: string) {
  return `${STORAGE_SUFFIX}:${ownerKey}`
}

function newId(prefix = "lib") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function seedLibrary(): InstructorLibraryItem[] {
  const now = Date.now()
  return [
    {
      id: newId("seed"),
      title: "Ohm's Law Calculator",
      category: "examples",
      languageId: "cpp",
      topic: "Arithmetic",
      week: "Week 3",
      difficulty: "beginner",
      tags: ["input", "output", "formulas"],
      description: "Reads voltage and resistance, prints current using I = V / R.",
      files: [
        {
          path: "main.cpp",
          content: `#include <iostream>
using namespace std;

int main() {
    double voltage = 0;
    double resistance = 0;
    cout << "Enter voltage: ";
    cin >> voltage;
    cout << "Enter resistance: ";
    cin >> resistance;
    if (resistance == 0) {
        cout << "Resistance cannot be zero." << endl;
        return 1;
    }
    double current = voltage / resistance;
    cout << "Current: " << current << " A" << endl;
    return 0;
}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId("seed"),
      title: "Loop Boundary Starter",
      category: "starter_code",
      languageId: "cpp",
      topic: "Loops",
      week: "Week 4",
      difficulty: "beginner",
      tags: ["for-loop", "starter"],
      description: "Empty loop scaffold for in-class live coding.",
      files: [
        {
          path: "main.cpp",
          content: `#include <iostream>
using namespace std;

int main() {
    for (int i = 0; i < 10; i++) {
        // TODO: print i
    }
    return 0;
}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId("seed"),
      title: "Assignment vs Comparison",
      category: "debugging",
      languageId: "cpp",
      topic: "Conditionals",
      difficulty: "beginner",
      tags: ["debugging", "if-statement"],
      description: "Common mistake: using = instead of == inside an if statement.",
      files: [
        {
          path: "main.cpp",
          content: `#include <iostream>
using namespace std;

int main() {
    int x = 5;
    if (x = 5) {
        cout << "This always runs because x was assigned, not compared." << endl;
    }
    return 0;
}`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function loadInstructorLibrary(ownerKey?: string): InstructorLibraryStore {
  const key = storageKey(ownerKey ?? instructorCodebenchOwnerKey())
  if (typeof window === "undefined") {
    return { version: 1, items: seedLibrary() }
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      const seeded = { version: 1 as const, items: seedLibrary() }
      window.localStorage.setItem(key, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as InstructorLibraryStore
    if (parsed?.version === 1 && Array.isArray(parsed.items)) return parsed
  } catch {
    // fall through
  }
  const seeded = { version: 1 as const, items: seedLibrary() }
  persistInstructorLibrary(seeded, ownerKey)
  return seeded
}

export function persistInstructorLibrary(store: InstructorLibraryStore, ownerKey?: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(ownerKey ?? instructorCodebenchOwnerKey()), JSON.stringify(store))
  } catch {
    // quota
  }
}

export function upsertLibraryItem(
  item: Omit<InstructorLibraryItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ownerKey?: string,
): InstructorLibraryItem {
  const store = loadInstructorLibrary(ownerKey)
  const now = Date.now()
  const next: InstructorLibraryItem = {
    ...item,
    id: item.id ?? newId(),
    createdAt: now,
    updatedAt: now,
  }
  const index = store.items.findIndex((entry) => entry.id === next.id)
  if (index >= 0) {
    store.items[index] = { ...store.items[index], ...next, createdAt: store.items[index].createdAt, updatedAt: now }
  } else {
    store.items.unshift(next)
  }
  persistInstructorLibrary(store, ownerKey)
  return index >= 0 ? store.items[index]! : next
}

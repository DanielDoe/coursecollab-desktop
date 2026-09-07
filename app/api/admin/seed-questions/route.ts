import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Add sample questions for testing
    const sampleQuestions = [
      {
        question_text: "What is the correct way to declare an array in C++?",
        question_type: "mcq",
        difficulty: "easy",
        topic: "Arrays",
        options: [
          { text: "int arr[5];", isCorrect: true },
          { text: "array<int> arr[5];", isCorrect: false },
          { text: "int arr = new int[5];", isCorrect: false },
          { text: "vector<int> arr[5];", isCorrect: false }
        ],
        correct_answer: "A",
        hint: "Arrays in C++ are declared with the data type followed by square brackets."
      },
      {
        question_text: "What will be the output of the following code?\n\n```cpp\nint arr[3] = {1, 2, 3};\ncout << arr[1];\n```",
        question_type: "mcq",
        difficulty: "easy",
        topic: "Arrays",
        options: [
          { text: "1", isCorrect: false },
          { text: "2", isCorrect: true },
          { text: "3", isCorrect: false },
          { text: "Error", isCorrect: false }
        ],
        correct_answer: "B",
        hint: "Array indexing starts from 0, so arr[1] refers to the second element."
      },
      {
        question_text: "Which of the following is true about arrays in C++?",
        question_type: "select_all",
        difficulty: "medium",
        topic: "Arrays",
        options: [
          { text: "Array size must be known at compile time", isCorrect: true },
          { text: "Arrays are passed by value to functions", isCorrect: false },
          { text: "Array elements are stored in contiguous memory", isCorrect: true },
          { text: "Arrays can be resized after declaration", isCorrect: false }
        ],
        correct_answer: ["A", "C"],
        hint: "Arrays have fixed size and are stored in contiguous memory locations."
      },
      {
        question_text: "What is the time complexity of accessing an element in an array?",
        question_type: "mcq",
        difficulty: "easy",
        topic: "Arrays",
        options: [
          { text: "O(1)", isCorrect: true },
          { text: "O(n)", isCorrect: false },
          { text: "O(log n)", isCorrect: false },
          { text: "O(n²)", isCorrect: false }
        ],
        correct_answer: "A",
        hint: "Array access is constant time because elements are stored in contiguous memory."
      },
      {
        question_text: "Fill in the blank: To find the length of an array in C++, you can use _____",
        question_type: "fill_blank",
        difficulty: "medium",
        topic: "Arrays",
        options: [],
        correct_answer: "sizeof(array)/sizeof(array[0])",
        hint: "This calculates the total size divided by the size of one element."
      }
    ]

    for (const question of sampleQuestions) {
      // Insert question into question_bank using JSONB schema
      const result = await sql`
        INSERT INTO question_bank (
          question_text,
          question_type,
          difficulty,
          topic,
          options,
          correct_answer,
          hint
        ) VALUES (
          ${question.question_text},
          ${question.question_type},
          ${question.difficulty},
          ${question.topic},
          ${JSON.stringify(question.options)},
          ${JSON.stringify(question.correct_answer)},
          ${question.hint}
        )
        RETURNING id
      `

      console.log(`Inserted question ${result[0].id}: ${question.question_text}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${sampleQuestions.length} sample questions` 
    })
  } catch (error) {
    console.error("Failed to seed questions:", error)
    return NextResponse.json({ error: "Failed to seed questions" }, { status: 500 })
  }
}

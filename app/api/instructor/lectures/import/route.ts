import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { getSessionCatalogFromDb } from "@/lib/session-catalog"

// 16 weeks of comprehensive C++ programming lecture data
const LECTURE_DATA = [
  // Week 1 - Introduction to Programming
  {
    week: 1,
    title: "Introduction to Programming Concepts",
    session: "",
    description: "Overview of programming fundamentals, algorithms, and problem-solving techniques. Introduction to C++ programming language and development environment setup.",
    materials_url: "/materials/week1-intro.pdf",
    status: "published"
  },
  {
    week: 1,
    title: "Variables and Data Types",
    session: "",
    description: "Understanding different data types in C++, variable declarations, constants, and basic input/output operations.",
    materials_url: "/materials/week1-variables.pdf",
    status: "published"
  },

  // Week 2 - Control Structures
  {
    week: 2,
    title: "Control Structures - Conditional Statements",
    session: "",
    description: "If, else-if, switch statements, logical operators, and conditional expressions in C++.",
    materials_url: "/materials/week2-conditionals.pdf",
    status: "published"
  },
  {
    week: 2,
    title: "Control Structures - Loops",
    session: "",
    description: "For loops, while loops, do-while loops, break and continue statements, and loop optimization techniques.",
    materials_url: "/materials/week2-loops.pdf",
    status: "published"
  },

  // Week 3 - Functions and Modularity
  {
    week: 3,
    title: "Functions - Basics",
    session: "",
    description: "Function declaration, definition, parameters, return values, and function overloading in C++.",
    materials_url: "/materials/week3-functions.pdf",
    status: "published"
  },
  {
    week: 3,
    title: "Functions - Advanced Concepts",
    session: "",
    description: "Recursion, function templates, inline functions, and scope and lifetime of variables.",
    materials_url: "/materials/week3-advanced-functions.pdf",
    status: "published"
  },

  // Week 4 - Arrays and Strings
  {
    week: 4,
    title: "Arrays - One Dimensional",
    session: "",
    description: "Array declaration, initialization, accessing elements, array manipulation, and common array algorithms.",
    materials_url: "/materials/week4-arrays.pdf",
    status: "published"
  },
  {
    week: 4,
    title: "Arrays - Multi-dimensional and Strings",
    session: "",
    description: "Two-dimensional arrays, string handling, string functions, and character manipulation.",
    materials_url: "/materials/week4-multidimensional.pdf",
    status: "published"
  },

  // Week 5 - Pointers and Memory Management
  {
    week: 5,
    title: "Pointers - Fundamentals",
    session: "",
    description: "Pointer declaration, pointer arithmetic, pointer to pointer, and dynamic memory allocation.",
    materials_url: "/materials/week5-pointers.pdf",
    status: "published"
  },
  {
    week: 5,
    title: "Pointers - Advanced Topics",
    session: "",
    description: "Pointer to functions, arrays of pointers, memory management, and common pointer pitfalls.",
    materials_url: "/materials/week5-advanced-pointers.pdf",
    status: "published"
  },

  // Week 6 - Object-Oriented Programming - Classes
  {
    week: 6,
    title: "Classes and Objects - Basics",
    session: "",
    description: "Class declaration, object creation, member variables, member functions, and access specifiers.",
    materials_url: "/materials/week6-classes.pdf",
    status: "published"
  },
  {
    week: 6,
    title: "Constructors and Destructors",
    session: "",
    description: "Default constructors, parameterized constructors, copy constructors, destructors, and object lifecycle.",
    materials_url: "/materials/week6-constructors.pdf",
    status: "published"
  },

  // Week 7 - Object-Oriented Programming - Inheritance
  {
    week: 7,
    title: "Inheritance - Single Inheritance",
    session: "",
    description: "Base and derived classes, access specifiers in inheritance, method overriding, and protected members.",
    materials_url: "/materials/week7-inheritance.pdf",
    status: "published"
  },
  {
    week: 7,
    title: "Inheritance - Multiple and Virtual",
    session: "",
    description: "Multiple inheritance, virtual functions, abstract classes, and polymorphism concepts.",
    materials_url: "/materials/week7-virtual-inheritance.pdf",
    status: "published"
  },

  // Week 8 - Operator Overloading
  {
    week: 8,
    title: "Operator Overloading - Unary and Binary",
    session: "",
    description: "Overloading unary and binary operators, friend functions, and operator precedence.",
    materials_url: "/materials/week8-operator-overloading.pdf",
    status: "published"
  },
  {
    week: 8,
    title: "Operator Overloading - Special Cases",
    session: "",
    description: "Assignment operator, stream operators, type conversion operators, and best practices.",
    materials_url: "/materials/week8-special-operators.pdf",
    status: "published"
  },

  // Week 9 - Templates
  {
    week: 9,
    title: "Function Templates",
    session: "",
    description: "Template functions, template parameters, template specialization, and generic programming.",
    materials_url: "/materials/week9-function-templates.pdf",
    status: "published"
  },
  {
    week: 9,
    title: "Class Templates",
    session: "",
    description: "Template classes, template member functions, template inheritance, and STL container basics.",
    materials_url: "/materials/week9-class-templates.pdf",
    status: "published"
  },

  // Week 10 - Exception Handling
  {
    week: 10,
    title: "Exception Handling - Basics",
    session: "",
    description: "Try-catch blocks, throwing exceptions, exception types, and exception safety.",
    materials_url: "/materials/week10-exceptions.pdf",
    status: "published"
  },
  {
    week: 10,
    title: "Exception Handling - Advanced",
    session: "",
    description: "Custom exception classes, exception specifications, RAII principle, and error handling strategies.",
    materials_url: "/materials/week10-advanced-exceptions.pdf",
    status: "published"
  },

  // Week 11 - File I/O and Streams
  {
    week: 11,
    title: "File I/O - Text Files",
    session: "",
    description: "File streams, reading and writing text files, file positioning, and error handling in file operations.",
    materials_url: "/materials/week11-text-files.pdf",
    status: "published"
  },
  {
    week: 11,
    title: "File I/O - Binary Files",
    session: "",
    description: "Binary file operations, object serialization, file formats, and data persistence.",
    materials_url: "/materials/week11-binary-files.pdf",
    status: "published"
  },

  // Week 12 - Data Structures - Basic
  {
    week: 12,
    title: "Linked Lists",
    session: "",
    description: "Singly linked lists, doubly linked lists, circular lists, and list operations.",
    materials_url: "/materials/week12-linked-lists.pdf",
    status: "published"
  },
  {
    week: 12,
    title: "Stacks and Queues",
    session: "",
    description: "Stack implementation, queue implementation, applications of stacks and queues, and priority queues.",
    materials_url: "/materials/week12-stacks-queues.pdf",
    status: "published"
  },

  // Week 13 - Data Structures - Advanced
  {
    week: 13,
    title: "Trees - Binary Trees",
    session: "",
    description: "Binary tree concepts, tree traversal algorithms, binary search trees, and tree operations.",
    materials_url: "/materials/week13-binary-trees.pdf",
    status: "published"
  },
  {
    week: 13,
    title: "Trees - Advanced Trees",
    session: "",
    description: "AVL trees, red-black trees, B-trees, and tree balancing techniques.",
    materials_url: "/materials/week13-advanced-trees.pdf",
    status: "published"
  },

  // Week 14 - Algorithms and Sorting
  {
    week: 14,
    title: "Sorting Algorithms - Basic",
    session: "",
    description: "Bubble sort, selection sort, insertion sort, and their time complexity analysis.",
    materials_url: "/materials/week14-basic-sorting.pdf",
    status: "published"
  },
  {
    week: 14,
    title: "Sorting Algorithms - Advanced",
    session: "",
    description: "Quick sort, merge sort, heap sort, and comparison of sorting algorithms.",
    materials_url: "/materials/week14-advanced-sorting.pdf",
    status: "published"
  },

  // Week 15 - Searching and Hashing
  {
    week: 15,
    title: "Searching Algorithms",
    session: "",
    description: "Linear search, binary search, interpolation search, and search complexity analysis.",
    materials_url: "/materials/week15-searching.pdf",
    status: "published"
  },
  {
    week: 15,
    title: "Hash Tables and Hashing",
    session: "",
    description: "Hash functions, collision resolution, open addressing, chaining, and hash table applications.",
    materials_url: "/materials/week15-hashing.pdf",
    status: "published"
  },

  // Week 16 - Advanced Topics and Review
  {
    week: 16,
    title: "STL - Standard Template Library",
    session: "",
    description: "STL containers, iterators, algorithms, and functional programming concepts in C++.",
    materials_url: "/materials/week16-stl.pdf",
    status: "published"
  },
  {
    week: 16,
    title: "Course Review and Best Practices",
    session: "",
    description: "Comprehensive review of C++ concepts, coding best practices, debugging techniques, and performance optimization.",
    materials_url: "/materials/week16-review.pdf",
    status: "published"
  }
]

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()

    // Check if lectures already exist
    const existingLectures = await sql`
      SELECT COUNT(*) as count FROM lectures
    `

    if (existingLectures[0]?.count > 0) {
      return NextResponse.json({ 
        message: "Lectures already exist in the database",
        count: existingLectures[0]?.count
      })
    }

    const catalog = await getSessionCatalogFromDb()
    const defaultSession = catalog[0]?.code ?? ""

    // Insert all lecture data
    const insertPromises = LECTURE_DATA.map((lecture) =>
      sql`
        INSERT INTO lectures (
          week, title, session, description, materials_url, status, created_at, updated_at
        )
        VALUES (
          ${lecture.week}, 
          ${lecture.title}, 
          ${lecture.session || defaultSession}, 
          ${lecture.description}, 
          ${lecture.materials_url}, 
          ${lecture.status}, 
          NOW(), 
          NOW()
        )
      `,
    )

    await Promise.all(insertPromises)

    return NextResponse.json({
      message: "Successfully imported 16 weeks of lecture data",
      count: LECTURE_DATA.length,
      lectures: LECTURE_DATA
    })
  } catch (error) {
    console.error("[v0] Failed to import lecture data:", error)
    return NextResponse.json({ error: "Failed to import lecture data" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()

    // Get current lecture count
    const lectureCount = await sql`
      SELECT COUNT(*) as count FROM lectures
    `

    // Get lecture distribution by week
    const weeklyDistribution = await sql`
      SELECT 
        week,
        COUNT(*) as lecture_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count
      FROM lectures
      GROUP BY week
      ORDER BY week ASC
    `

    return NextResponse.json({
      total_lectures: lectureCount[0]?.count || 0,
      weekly_distribution: weeklyDistribution,
      expected_lectures: LECTURE_DATA.length,
      import_available: (lectureCount[0]?.count || 0) === 0
    })
  } catch (error) {
    console.error("[v0] Failed to fetch import status:", error)
    return NextResponse.json({ error: "Failed to fetch import status" }, { status: 500 })
  }
}

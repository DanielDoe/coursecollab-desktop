/**
 * Run: npx tsx --test lib/codebench-course-topics.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyCodebenchCourseTopic,
  codebenchTopicsPresent,
  groupRowsByCodebenchTopic,
} from "./codebench-course-topics"

describe("CodeBench course topics", () => {
  it("maps stored aliases onto the compact CS1 list", () => {
    assert.equal(classifyCodebenchCourseTopic("Loops").id, "for-loops")
    assert.equal(classifyCodebenchCourseTopic("Conditionals").id, "if-statements")
    assert.equal(classifyCodebenchCourseTopic("Arithmetic").id, "basic-arithmetic")
    assert.equal(classifyCodebenchCourseTopic("Input/output").id, "input-output")
  })

  it("classifies closely related prompts instead of one topic per question", () => {
    assert.equal(
      classifyCodebenchCourseTopic("Account Minimum Balance Check", "A bank requires customers to maintain a minimum account balance of $500").id,
      "if-statements",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Machine Temperature Status", "A manufacturing machine should operate at a temperature of 80C or lower").id,
      "if-statements",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Print a greeting", "Use printf to display Hello World").id,
      "input-output",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Sum of two numbers", "Read two integers and print their sum").id,
      "basic-arithmetic",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Grade letter", "Use nested if or else if to assign A, B, or C").id,
      "nested-if",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Menu", "Use a switch statement to handle each case").id,
      "switch",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Absolute value", "Rewrite the if/else with the ternary operator x > 0 ? x : -x").id,
      "ternary",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Countdown", "Keep asking with a while loop until the user enters 0").id,
      "while-loops",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Repeat until valid", "Use a do-while loop to re-prompt").id,
      "do-while",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Count to ten", "Write a for loop that prints 1 through 10").id,
      "for-loops",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Times table", "Print a multiplication table with nested for loops").id,
      "nested-for",
    )
    assert.equal(
      classifyCodebenchCourseTopic(
        "Engineering Unit Converter Menu",
        "The user enters a menu option and a value: * `1` → Convert meters to centimeters",
      ).id,
      "switch",
    )
    assert.equal(
      classifyCodebenchCourseTopic(
        "Package Weight Surcharge",
        "If a package weighs more than 20 kg, an additional $12.00 surcharge is added.",
      ).id,
      "if-statements",
    )
    assert.equal(
      classifyCodebenchCourseTopic("Hourly Pay Calculator", "Ask for hours worked and hourly pay rate. Calculate total earnings.").id,
      "basic-arithmetic",
    )
    assert.equal(
      classifyCodebenchCourseTopic(
        "Classroom Points: Find Maximum Using Pointer",
        "Create an array of 5 integers. Write a function findMax that takes a pointer.",
      ).id,
      "pointers",
    )
  })

  it("groups rows in curriculum order", () => {
    const rows = [
      { title: "Times table with nested for loops" },
      { title: "Use printf to print Hello World" },
      { title: "Write a for loop that prints 1 through 10" },
    ]
    const grouped = groupRowsByCodebenchTopic(rows, (row) => classifyCodebenchCourseTopic(row.title))
    assert.deepEqual(
      grouped.map(([topic]) => topic.id),
      ["input-output", "for-loops", "nested-for"],
    )
    assert.deepEqual(
      codebenchTopicsPresent(rows, (row) => classifyCodebenchCourseTopic(row.title)).map((topic) => topic.id),
      ["input-output", "for-loops", "nested-for"],
    )
  })
})

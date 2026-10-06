/**
 * Run: npx tsx --test lib/classroom-syntax-reference.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { syntaxCardsForClassroomPrompt } from "./classroom-syntax-reference"
import { structureClassroomPrompt } from "./classroom-question-layout"

const ids = (title: string, text: string) =>
  syntaxCardsForClassroomPrompt(title, text).map((card) => card.id)

describe("syntaxCardsForClassroomPrompt", () => {
  it("shows only variables and input for a formula program", () => {
    assert.deepEqual(
      ids(
        "simple interest calculation",
        "Write a C++ program that calculates simple interest. The program should take principal amount, rate of interest, and time period as input, then calculate and display the simple interest using the formula: SI = (P * R * T) / 100.",
      ),
      ["variables", "input-output"],
    )
  })

  it("adds comparison and if/else when the prompt branches once", () => {
    assert.deepEqual(
      ids(
        "Voting Eligibility",
        "Write a C++ program that asks the user for their age. If the age is 18 or older, display Eligible. Otherwise, display Not eligible.",
      ),
      ["variables", "input-output", "comparison", "if-else"],
    )
  })

  it("adds a nested if only when a second check sits inside the first", () => {
    const picked = ids(
      "Warehouse Package Acceptance",
      "Write a C++ program. First check whether the package weighs 50 kg or less. Only if the weight is acceptable, check the shipping label. Otherwise reject it.",
    )
    assert.ok(picked.includes("nested-if"))
    assert.ok(picked.includes("if-else"))
    assert.equal(picked.includes("switch"), false)
  })

  it("uses else if for a chain and does not add a nested if", () => {
    const picked = ids(
      "Shopping Discount",
      "Use if / else if / else. Less than $100 no discount, else if at least $100 then 10%, else 15%.",
    )
    assert.ok(picked.includes("else-if"))
    assert.equal(picked.includes("nested-if"), false)
  })

  it("keeps a switch prompt on switch, not if/else", () => {
    const picked = ids(
      "Parking Garage Rate Selector",
      "Write a C++ program. Read a menu choice and use a switch statement. case 1 motorcycle, case 2 car.",
    )
    assert.ok(picked.includes("switch"))
    assert.equal(picked.includes("if-else"), false)
    assert.equal(picked.includes("nested-if"), false)
  })

  it("shows a for loop without a nested for loop", () => {
    const picked = ids("Count to n", "Write a C++ program that uses a for loop to print the numbers from 1 to n.")
    assert.deepEqual(picked, ["variables", "input-output", "for"])
  })

  it("shows nested for loops for a pattern", () => {
    const picked = ids("Increasing Triangle", "Use nested for loops to print a triangle pattern of stars.")
    assert.ok(picked.includes("nested-for"))
  })

  it("shows comparison and a while loop when the prompt repeats with a condition", () => {
    const picked = ids(
      "While Loop — Rocket Launch Countdown",
      "Write a C++ program. Use a while loop. Start at 10 and keep going while the count is greater than 0. Then display LIFTOFF!",
    )
    assert.ok(picked.includes("while"))
    assert.ok(picked.includes("comparison"))
    assert.ok(picked.includes("variables"))
    assert.equal(picked.includes("if-else"), false)
    assert.equal(picked.includes("for"), false)
  })

  it("adds if/else inside a while loop when the prompt branches", () => {
    const picked = ids(
      "While Loop — Password Attempt",
      "Write a C++ program. Use a while loop while attempts are greater than 0. If the password matches, display Access granted. Otherwise display Access denied.",
    )
    assert.ok(picked.includes("while"))
    assert.ok(picked.includes("if-else"))
    assert.ok(picked.includes("comparison"))
  })

  it("does not treat do-while as a while loop", () => {
    const picked = ids("Password Retry", "Use a do-while loop to keep asking until the password is correct.")
    assert.ok(picked.includes("do-while"))
    assert.equal(picked.includes("while"), false)
  })

  it("treats a range of discounts as else-if, not a switch", () => {
    assert.deepEqual(
      ids(
        "Shopping Discount with Minimum Purchase",
        "Write a C++ program. Less than $100 → No discount. $100 to $200 → 10% discount. Greater than $200 → 15% discount.",
      ),
      ["variables", "input-output", "comparison", "else-if"],
    )
  })

  it("keeps an invalid menu choice inside switch instead of adding if/else", () => {
    const picked = ids(
      "Parking Garage Rate Selector",
      "1 → Motorcycle. 2 → Car. Use a switch statement. If the user enters any other number, display Invalid vehicle type.",
    )
    assert.ok(picked.includes("switch"))
    assert.equal(picked.includes("if-else"), false)
  })

  it("keeps a real if rule when the prompt also uses switch", () => {
    const picked = ids(
      "Restaurant Order",
      "Write a C++ program. Use a switch statement for the meal. If delivery is requested and the subtotal is less than $30, add a charge.",
    )
    assert.ok(picked.includes("switch"))
    assert.ok(picked.includes("if-else"))
  })

  it("shows MATLAB patterns instead of C++ patterns", () => {
    const picked = ids(
      "Classroom Points (MATLAB): Flow Control — If Statement",
      "Write a MATLAB if statement.",
    )
    assert.deepEqual(picked, ["matlab-commands", "matlab-if"])
  })

  it("adds an if / else if card for tiered and overtime prompts", () => {
    assert.ok(
      ids(
        "Electricity Bill Calculator (Tiered Pricing)",
        "The first 500 kWh costs $0.12. Any electricity used above 500 kWh costs $0.18.",
      ).includes("else-if"),
    )
    assert.ok(
      ids(
        "Employee Salary with Overtime",
        "Any hours worked beyond 40 are paid at 1.5 times the regular hourly rate.",
      ).includes("else-if"),
    )
  })
})

describe("structureClassroomPrompt", () => {
  it("pulls inputs and a formula out of a plain sentence", () => {
    const blocks = structureClassroomPrompt(
      "Write a C++ program that calculates simple interest. The program should take principal amount, rate of interest, and time period as input, then calculate and display the simple interest using the formula: SI = (P * R * T) / 100.",
    )
    assert.equal(blocks.some((block) => block.type === "chips" && block.items.length === 3), true)
    assert.equal(blocks.some((block) => block.type === "callout" && block.body.includes("SI =")), true)
    const task = blocks.find((block) => block.type === "prose")
    assert.equal(task?.type, "prose")
    if (task?.type === "prose") {
      assert.equal(task.paragraphs.join(" ").includes("formula"), false)
      assert.equal(task.paragraphs[0]?.endsWith("simple interest."), true)
    }
  })

  it("turns markdown problem, requirements, and sample into sections", () => {
    const blocks = structureClassroomPrompt(
      "### Problem\n\nCheck the age.\n\n### Requirements\n\n* Read the age.\n* Use if-else.\n\n### Sample Input\n\n```text\n20\n```\n\n### Expected Output\n\n```text\nEligible\n```",
    )
    assert.equal(blocks.some((block) => block.type === "markdown"), false)
    assert.equal(
      blocks.some((block) => block.type === "prose" && block.paragraphs.join(" ").includes("Check the age")),
      true,
    )
    const requirements = blocks.find((block) => block.type === "list")
    assert.equal(requirements?.type, "list")
    if (requirements?.type === "list") {
      assert.equal(requirements.title, "Requirements")
      assert.equal(requirements.items.length, 2)
    }
    const example = blocks.find((block) => block.type === "example")
    assert.equal(example?.type, "example")
    if (example?.type === "example") {
      assert.equal(example.input, "20")
      assert.equal(example.output, "Eligible")
    }
  })

  it("lays out bullet rules, inputs, and a task instead of one paragraph", () => {
    const blocks = structureClassroomPrompt(`Ticket prices:

• Child (C) → $6
• Adult (A) → $12

Rules:
• If the code is anything else → Invalid

Inputs:
• Ticket type

Task:
Use a switch statement to output the ticket price.`)
    const prices = blocks.find((block) => block.type === "list" && block.title.toLowerCase().includes("ticket"))
    assert.equal(prices?.type, "list")
    if (prices?.type === "list") {
      assert.equal(prices.items[0]?.label, "Child (C)")
      assert.equal(prices.items[0]?.text, "$6")
    }
    assert.equal(blocks.some((block) => block.type === "list" && block.title === "Rules"), true)
    assert.equal(blocks.some((block) => block.type === "inputs"), true)
    assert.equal(
      blocks.some((block) => block.type === "note" && block.body.includes("switch statement")),
      true,
    )
    assert.equal(blocks.some((block) => block.type === "prose"), false)
  })

  it("splits rules, a display note, and the sample from a plain prompt", () => {
    const blocks = structureClassroomPrompt(
      "A movie theater offers different ticket prices based on a customer's age. Write a complete C++ program that asks the user to enter their age and determines the ticket price using if/else statements. Use the following rules: - Age 12 or younger: $6 - Age 13 through 64: $10 - Age 65 or older: $7 - A negative age is invalid. The program must display either the ticket price or INVALID AGE. Sample input: 20 Expected output: Ticket Price: $10",
    )
    const rules = blocks.find((block) => block.type === "list")
    assert.equal(rules?.type, "list")
    if (rules?.type === "list") {
      assert.equal(rules.items.length, 4)
      assert.equal(rules.items[0]?.label, "Age 12 or younger")
      assert.equal(rules.items[0]?.text, "$6")
    }
    const example = blocks.find((block) => block.type === "example")
    assert.equal(example?.type, "example")
    if (example?.type === "example") {
      assert.equal(example.input, "20")
      assert.equal(example.output, "Ticket Price: $10")
    }
    const prose = blocks.find((block) => block.type === "prose")
    assert.equal(prose?.type === "prose" && prose.paragraphs.join(" ").includes("Age 12"), false)
  })

  it("keeps multiline sample input and output together", () => {
    const blocks = structureClassroomPrompt(`Ask the user to enter:
- meal choice: 1 for Burger, 2 for Pizza
- quantity ordered

Sample input:
2
3
Expected output:
Order Type: DELIVERY
Final Total: $36.00`)
    const inputs = blocks.find((block) => block.type === "inputs")
    assert.equal(inputs?.type, "inputs")
    if (inputs?.type === "inputs") assert.equal(inputs.items.length, 2)
    const example = blocks.find((block) => block.type === "example")
    assert.equal(example?.type, "example")
    if (example?.type === "example") {
      assert.equal(example.input, "2\n3")
      assert.equal(example.output, "Order Type: DELIVERY\nFinal Total: $36.00")
    }
  })
})

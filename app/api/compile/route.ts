import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"

export async function POST(request: NextRequest) {
  console.log("[v0] ========== COMPILE API START ==========")
  console.log("[v0] Compile API: Received compilation request via Judge0")
  console.log("[v0] Timestamp:", new Date().toISOString())

  try {
    const { code, stdin = "", studentId } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    console.log("[v0] ===== REQUEST DETAILS =====")
    console.log("[v0] Code length:", code?.length || 0, "characters")
    console.log("[v0] Code preview (first 100 chars):", code?.substring(0, 100))
    console.log("[v0] stdin provided:", !!stdin)
    console.log("[v0] stdin content:", stdin || "(empty)")

    if (!code) {
      console.error("[v0] ❌ Compile API: No code provided")
      return NextResponse.json({ success: false, error: "No code provided" }, { status: 400 })
    }

    // Check for RapidAPI key
    if (!process.env.RAPIDAPI_KEY) {
      console.error("[v0] ❌ Compile API: RAPIDAPI_KEY environment variable not set")
      return NextResponse.json(
        { success: false, error: "Server configuration error: RAPIDAPI_KEY not set" },
        { status: 500 },
      )
    }

    console.log("[v0] ✅ RAPIDAPI_KEY is configured")
    console.log("[v0] Encoding code and stdin to base64...")
    const base64Code = Buffer.from(code).toString("base64")
    const base64Stdin = Buffer.from(stdin).toString("base64")
    console.log("[v0] Base64 code length:", base64Code.length, "characters")
    console.log("[v0] Base64 stdin length:", base64Stdin.length, "characters")

    console.log("[v0] ===== SENDING TO JUDGE0 =====")
    console.log("[v0] Endpoint: https://judge0-ce.p.rapidapi.com/submissions")
    console.log("[v0] Language ID: 54 (C++ GCC 9.2.0)")
    const startTime = Date.now()

    const response = await fetch("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        source_code: base64Code,
        language_id: 54, // C++ (GCC 9.2.0)
        stdin: base64Stdin,
      }),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })

    const requestTime = Date.now() - startTime
    console.log("[v0] ===== JUDGE0 RESPONSE =====")
    console.log("[v0] Response received in", requestTime, "ms")
    console.log("[v0] Response status:", response.status, response.statusText)
    console.log("[v0] Response ok:", response.ok)
    console.log("[v0] Response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ❌ Judge0 API returned error status:", response.status)
      console.error("[v0] Error response body:", errorText)

      let errorMessage = "Failed to compile code"

      try {
        const errorData = JSON.parse(errorText)
        console.error("[v0] Parsed error data:", errorData)
        if (errorData.message) {
          errorMessage = errorData.message

          // Provide helpful message for subscription errors
          if (response.status === 403 || errorMessage.includes("not subscribed")) {
            errorMessage =
              "Judge0 CE API subscription required. Please subscribe at: https://rapidapi.com/judge0-official/api/judge0-ce (Free tier available)"
          }
        }
      } catch {
        // If error response is not JSON, use the text as-is
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`
      }

      console.log("[v0] ========== COMPILE API END (ERROR) ==========")
      return NextResponse.json({ success: false, error: errorMessage }, { status: response.status })
    }

    let result: any = {}
    try {
      const responseText = await response.text()
      console.log("[v0] ===== PARSING RESPONSE =====")
      console.log("[v0] Response text length:", responseText.length, "characters")
      console.log("[v0] Response text preview:", responseText.substring(0, 200))

      result = JSON.parse(responseText)
      console.log("[v0] ✅ Successfully parsed JSON response")
      console.log("[v0] ===== JUDGE0 RESULT DETAILS =====")
      console.log("[v0] Status ID:", result.status?.id)
      console.log("[v0] Status description:", result.status?.description)
      console.log("[v0] Time:", result.time, "seconds")
      console.log("[v0] Memory:", result.memory, "KB")
      console.log("[v0] Has stdout:", !!result.stdout)
      console.log("[v0] Has stderr:", !!result.stderr)
      console.log("[v0] Has compile_output:", !!result.compile_output)

      if (result.stdout) {
        const decodedStdout = Buffer.from(result.stdout, "base64").toString("utf-8")
        console.log("[v0] Decoded stdout length:", decodedStdout.length, "characters")
        console.log("[v0] Decoded stdout content:", decodedStdout)
        result.stdout = decodedStdout
      } else {
        console.log("[v0] ⚠️ No stdout in response")
      }

      if (result.stderr) {
        const decodedStderr = Buffer.from(result.stderr, "base64").toString("utf-8")
        console.log("[v0] Decoded stderr length:", decodedStderr.length, "characters")
        console.log("[v0] Decoded stderr content:", decodedStderr)
        result.stderr = decodedStderr
      } else {
        console.log("[v0] No stderr in response")
      }

      if (result.compile_output) {
        const decodedCompileOutput = Buffer.from(result.compile_output, "base64").toString("utf-8")
        console.log("[v0] Decoded compile_output length:", decodedCompileOutput.length, "characters")
        console.log("[v0] Decoded compile_output content:", decodedCompileOutput)
        result.compile_output = decodedCompileOutput
      } else {
        console.log("[v0] No compile_output in response")
      }
    } catch (parseError) {
      console.error("[v0] ❌ Failed to parse JSON response:", parseError)
      console.error("[v0] Response might be plain text or invalid JSON")
      console.log("[v0] ========== COMPILE API END (PARSE ERROR) ==========")
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from Judge0 API. The service might be unavailable.",
        },
        { status: 500 },
      )
    }

    console.log("[v0] ===== CHECKING EXECUTION STATUS =====")
    if (result.status?.id >= 6 && result.status?.id <= 12) {
      // Status IDs 6-12 are various error states in Judge0
      console.error("[v0] ❌ Judge0 execution error detected")
      console.error("[v0] Error status ID:", result.status?.id)
      console.error("[v0] Error description:", result.status?.description)
      console.log("[v0] ========== COMPILE API END (EXECUTION ERROR) ==========")
      return NextResponse.json({
        success: false,
        error: result.status?.description || "Compilation or execution error",
        stderr: result.stderr || result.compile_output || "",
      })
    }

    console.log("[v0] ===== FINAL RESULT =====")
    console.log("[v0] ✅ Compilation/execution successful")
    console.log("[v0] Final stdout:", result.stdout || "(empty)")
    console.log("[v0] Final stderr:", result.stderr || "(empty)")
    console.log("[v0] Final compile_output:", result.compile_output || "(empty)")
    console.log("[v0] ========== COMPILE API END (SUCCESS) ==========")

    // Determine the best output to show
    let displayOutput = ""
    let outputType = "success"
    
    if (result.stdout) {
      displayOutput = result.stdout
      outputType = "success"
    } else if (result.stderr) {
      displayOutput = result.stderr
      outputType = "error"
    } else if (result.compile_output) {
      displayOutput = result.compile_output
      outputType = "compile_error"
    } else {
      displayOutput = "⚠️ No output received"
      outputType = "warning"
    }

    return NextResponse.json({
      success: true,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      status: result.status?.description || "Unknown",
      output: displayOutput,
      outputType: outputType,
      debug: {
        statusId: result.status?.id,
        time: result.time,
        memory: result.memory,
        hasInput: !!stdin,
        inputLength: stdin.length,
      },
    })
  } catch (error: any) {
    console.error("[v0] ❌ Compile API: Fatal error:", error)
    console.error("[v0] Error type:", error?.name)
    console.error("[v0] Error message:", error?.message)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    
    let errorMessage = "Failed to compile code using Judge0"
    
    if (error?.name === "TimeoutError" || error?.message?.includes("timeout")) {
      errorMessage = "Code compilation timed out. Please try again with simpler code or check your internet connection."
    } else if (error?.name === "AbortError") {
      errorMessage = "Request was aborted due to timeout. Please try again."
    } else if (error?.message?.includes("fetch")) {
      errorMessage = "Network error occurred. Please check your internet connection and try again."
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    console.log("[v0] ========== COMPILE API END (FATAL ERROR) ==========")
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}

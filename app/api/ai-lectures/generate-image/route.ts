import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { sql } from "@/lib/db"
import { savePublicUpload } from "@/lib/blob-or-local-public"

// Check if OpenAI API key is configured
const isOpenAIConfigured = !!process.env.OPENAI_API_KEY

const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lecture_id,
      slide_index,
      slide_heading,
      slide_content,
      style = "simple vector diagram"
    } = body

    // Check if OpenAI is configured
    if (!isOpenAIConfigured || !openai) {
      console.warn("[AI Image] OpenAI API key not configured")
      return NextResponse.json({
        error: "AI Image Generation is not configured. Please add your OpenAI API key to the .env.local file.",
        isConfigured: false
      }, { status: 503 })
    }

    // Generate prompt for image
    const prompt = `Create a ${style} for a programming lecture slide titled "${slide_heading}". 
Context: ${slide_content}. 
Style: Clean, educational, minimalist, suitable for a computer science course. 
No text in the image, just visual representation.`

    console.log("[AI Image] Generating image with prompt:", prompt)

    // Generate image using DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    })

    const imageUrl = response.data[0].url

    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI")
    }

    // Download and save the image
    const imageResponse = await fetch(imageUrl)
    const arrayBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get lecture info to determine save path
    const lecture = await sql`
      SELECT media_folder FROM lectures WHERE id = ${lecture_id}
    `

    if (lecture.length === 0) {
      throw new Error("Lecture not found")
    }

    const mediaFolder = lecture[0].media_folder || `lectures/lecture-${lecture_id}`
    const filename = `ai-generated-slide-${slide_index}.png`
    const relativePath = `uploads/${mediaFolder}/${filename}`.replace(/\\/g, "/")

    const publicUrl = await savePublicUpload({
      blobKey: relativePath.replace(/^uploads\//, ""),
      relativePublicPath: relativePath,
      bytes: buffer,
      contentType: "image/png",
    })

    // Update lecture slides with new image URL
    const lectureData = await sql`
      SELECT slides FROM lectures WHERE id = ${lecture_id}
    `

    if (lectureData.length > 0) {
      const slides = lectureData[0].slides
      if (slides[slide_index]) {
        slides[slide_index].image = publicUrl
        slides[slide_index].image_missing = false
        slides[slide_index].ai_generated = true

        await sql`
          UPDATE lectures 
          SET slides = ${JSON.stringify(slides)}, updated_at = NOW()
          WHERE id = ${lecture_id}
        `
      }
    }

    console.log("[AI Image] Generated and saved:", publicUrl)

    return NextResponse.json({ 
      imageUrl: publicUrl,
      message: "Image generated successfully"
    })
  } catch (error: any) {
    console.error("[AI Image] Error:", error)
    
    // Provide helpful error messages
    if (error.code === 'insufficient_quota') {
      return NextResponse.json({
        error: "AI Image Generation has reached its usage limit. Please contact your instructor.",
        isConfigured: false
      }, { status: 503 })
    }
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json({
        error: "AI Image Generation is misconfigured. Please contact your instructor.",
        isConfigured: false
      }, { status: 503 })
    }

    return NextResponse.json({ 
      error: "Failed to generate image",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}



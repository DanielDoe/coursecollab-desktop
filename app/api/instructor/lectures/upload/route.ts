import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { replaceLectureSessionAccessFromRecord } from "@/lib/lecture-session-access-sync"
import { savePublicUpload } from "@/lib/blob-or-local-public"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const courseId = scope.course.id
    const formData = await request.formData()
    const jsonFile = formData.get("json") as File
    const imageFiles = formData.getAll("images") as File[]
    const lectureTitle = (formData.get("title") as string) || "untitled"

    if (!jsonFile) {
      return NextResponse.json({ error: "JSON file required" }, { status: 400 })
    }

    const jsonText = await jsonFile.text()
    const lectureData = JSON.parse(jsonText) as {
      title: string
      week?: number
      description?: string
      objectives?: unknown[]
      slides: Array<{ image?: string; quiz?: unknown; image_missing?: boolean }>
      is_active?: boolean
      is_published?: boolean
      session_access?: unknown
      media_folder?: string
    }

    const sanitizedTitle = lectureTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")
    const timestamp = Date.now()
    const lectureFolder = `lectures/${sanitizedTitle}-${timestamp}`

    const imageMap: Record<string, string> = {}

    for (const imageFile of imageFiles) {
      if (imageFile.size > 0) {
        const buffer = Buffer.from(await imageFile.arrayBuffer())
        const filename = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image.png"
        const publicUrl = await savePublicUpload({
          blobKey: `${lectureFolder}/${filename}`,
          relativePublicPath: `uploads/${lectureFolder}/${filename}`,
          bytes: buffer,
          contentType: imageFile.type || "image/png",
        })
        imageMap[imageFile.name] = publicUrl
        imageMap[filename] = publicUrl
      }
    }

    const mediaFolder = lectureData.media_folder || lectureFolder

    lectureData.slides = lectureData.slides.map((slide, index) => {
      if (slide.image) {
        if (slide.image.startsWith("http")) return slide
        if (imageMap[slide.image]) {
          slide.image = imageMap[slide.image]
          return slide
        }
        console.warn(`[Upload] Slide ${index}: missing image ${slide.image}`)
        slide.image_missing = true
      } else {
        slide.image_missing = true
      }
      return slide
    })

    const totalXp =
      lectureData.slides.length * 10 +
      lectureData.slides.filter((s) => s.quiz).length * 20

    const published =
      lectureData.is_active !== undefined
        ? Boolean(lectureData.is_active)
        : lectureData.is_published !== undefined
          ? Boolean(lectureData.is_published)
          : true

    const sessionCol =
      lectureData.session_access === null || lectureData.session_access === undefined
        ? null
        : JSON.stringify(lectureData.session_access)

    const lecture = await sql`
      INSERT INTO lectures (
        title, week, description, objectives, slides,
        course_id, session_access, is_published, total_xp,
        media_folder, created_at, updated_at
      ) VALUES (
        ${lectureData.title}, 
        ${lectureData.week || 1}, 
        ${lectureData.description || ""}, 
        ${JSON.stringify(lectureData.objectives || [])}, 
        ${JSON.stringify(lectureData.slides)}, 
        ${courseId},
        ${sessionCol},
        ${published}, 
        ${totalXp},
        ${mediaFolder},
        NOW(), 
        NOW()
      ) RETURNING *
    `

    await replaceLectureSessionAccessFromRecord(sql, lecture[0].id, lectureData.session_access ?? null)
    return NextResponse.json({
      lecture: lecture[0],
      uploadedImages: Object.keys(imageMap).length,
      imageMap,
      message: "Lecture uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading lecture:", error)
    return NextResponse.json(
      {
        error: "Failed to upload lecture",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

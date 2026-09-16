import { sql } from "@/lib/db"
import { ensureDirectMessagesSchema } from "@/lib/ensure-direct-messages-schema"
import type { MessageActor } from "@/lib/direct-messages/types"
import { isPersistedMessageAttachmentUrl } from "@/lib/direct-messages/attachments"

const STAGING_TTL_DAYS = 14

export type StagedMessageUpload = {
  fileName: string
  fileUrl: string
  mimeType: string | null
  fileSize: number | null
}

export async function registerStagedMessageUpload(
  uploader: MessageActor,
  upload: StagedMessageUpload,
): Promise<void> {
  await ensureDirectMessagesSchema()
  if (!isPersistedMessageAttachmentUrl(upload.fileUrl)) {
    throw new Error("Upload did not return a storable URL")
  }
  if (!upload.fileName?.trim()) {
    throw new Error("Upload is missing a file name")
  }

  await sql`
    INSERT INTO dm_message_upload_staging (
      uploader_kind,
      uploader_id,
      file_url,
      file_name,
      mime_type,
      file_size
    )
    VALUES (
      ${uploader.kind},
      ${uploader.id},
      ${upload.fileUrl},
      ${upload.fileName.trim()},
      ${upload.mimeType ?? null},
      ${upload.fileSize ?? null}
    )
    ON CONFLICT (file_url) DO UPDATE SET
      file_name = EXCLUDED.file_name,
      mime_type = EXCLUDED.mime_type,
      file_size = EXCLUDED.file_size,
      created_at = NOW(),
      consumed_at = NULL,
      message_id = NULL
  `
}

/** Bind staged uploads to a message; throws if any URL was not uploaded by this sender. */
export async function consumeStagedMessageUploads(
  sender: MessageActor,
  messageId: number,
  attachments: StagedMessageUpload[],
): Promise<void> {
  await ensureDirectMessagesSchema()
  for (const att of attachments) {
    if (!isPersistedMessageAttachmentUrl(att.fileUrl)) {
      throw new Error("One or more attachments did not upload correctly. Attach the files again.")
    }

    const rows = (await sql`
      UPDATE dm_message_upload_staging
      SET consumed_at = NOW(),
          message_id = ${messageId}
      WHERE file_url = ${att.fileUrl}
        AND uploader_kind = ${sender.kind}
        AND uploader_id = ${sender.id}
        AND consumed_at IS NULL
        AND created_at > NOW() - (${STAGING_TTL_DAYS}::int * INTERVAL '1 day')
      RETURNING id
    `) as Array<{ id: number }>

    if (rows.length === 0) {
      throw new Error(
        "An attachment expired or was not uploaded through Messages. Remove it and attach again.",
      )
    }
  }
}

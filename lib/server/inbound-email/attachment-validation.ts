const ALLOWED_CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);

export type AttachmentCandidate = {
  id: string;
  filename: string;
  contentType: string | null;
  downloadUrl: string;
  size: number | null;
};

export function sanitizeAttachmentFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? "attachment.csv";
  const sanitized = baseName.replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return sanitized.length > 0 ? sanitized.slice(0, 180) : "attachment.csv";
}

export function isCsvAttachment(
  attachment: Pick<AttachmentCandidate, "filename" | "contentType">,
): boolean {
  const lowerName = attachment.filename.toLowerCase();
  if (!lowerName.endsWith(".csv")) {
    return false;
  }

  if (!attachment.contentType) {
    return true;
  }

  const normalized = attachment.contentType.toLowerCase().split(";")[0]?.trim();
  return ALLOWED_CSV_MIME_TYPES.has(normalized);
}

export function looksLikeCsvContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return false;
  }

  const firstLine = lines[0] ?? "";
  return firstLine.includes(",") || firstLine.includes("\t") || lines.length > 1;
}

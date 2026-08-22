// DRF returns validation errors as { field_name: ["message", ...], ... }
// (plus sometimes a "non_field_errors" or "detail" key for form-wide
// issues). This turns that into a per-field map so the UI can show each
// message next to the actual input it belongs to, instead of one
// generic blob of text with no indication of which field is wrong.
export function parseFieldErrors(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object') return { _general: 'Something went wrong. Please try again.' }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.join(' ') : String(value)
    result[key === 'non_field_errors' || key === 'detail' ? '_general' : key] = message
  }
  return result
}

// Pulls distinct {{variable_name}} tokens out of a template body, in the
// order they first appear, so the compose form can render exactly the
// inputs a given template actually needs — no more, no less.
export function extractTemplateVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)
  const seen = new Set<string>()
  const result: string[] = []
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      result.push(m[1])
    }
  }
  return result
}

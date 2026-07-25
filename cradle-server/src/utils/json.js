export function parseLooseJsonObject(raw) {
  const text = String(raw ?? "").trim();

  // 1. 整段本來就是 JSON
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // 2. 只允許抓 ```json ... ```
  const jsonFenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);

  if (jsonFenceMatch) {
    return JSON.parse(jsonFenceMatch[1].trim());
  }

  // 3. fallback：抓第一個 { 到最後一個 }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonText = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonText);
  }

  throw new Error("No valid JSON object found in AI response.");
}

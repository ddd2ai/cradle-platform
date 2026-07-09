export class ArtifactParser {
  /**
   * 核心原則:
   * 1. Parser 只抽出外層 JSON
   * 2. Parser 只修 trailing comma
   * 3. Parser 只做 JSON.parse
   * 4. Parser 不准改 outputs[].content
   * 5. content 清理全部交給 ArtifactNormalizer
   */
  parse(raw) {
    const text = String(raw ?? "").trim();

    if (!text) {
      throw new Error("ArtifactParser: empty response");
    }

    // Step 1: 抽取 JSON 物件
    const jsonText = this.extractJsonObject(text);

    // Step 2: 修復 trailing comma
    const repaired = this.repairCommonJsonIssues(jsonText);

    // Step 3: JSON.parse
    try {
      return JSON.parse(repaired);
    } catch (error) {
      throw new Error(
        [
          "Failed to parse extracted JSON",
          "",
          `Error: ${error.message}`,
          "",
          "Preview:",
          this.preview(repaired),
        ].join("\n")
      );
    }
  }

  extractJsonObject(raw) {
    const text = String(raw ?? "").trim();

    // 1. 整段就是 JSON
    if (text.startsWith("{") && text.endsWith("}")) {
      return text;
    }

    // 2. 只抽 ```json ... ```
    const jsonFenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);

    if (jsonFenceMatch) {
      return jsonFenceMatch[1].trim();
    }

    // 3. fallback: 第一個 { 到最後一個 }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }

    throw new Error("No JSON object found in AI response.");
  }

  repairCommonJsonIssues(jsonText) {
    // 只修 trailing comma
    return String(jsonText)
      .replace(/,\s*([}\]])/g, "$1")
      .trim();
  }

  preview(text, head = 500, tail = 500) {
    const value = String(text ?? "");

    if (value.length <= head + tail) {
      return value;
    }

    return [
      value.slice(0, head),
      "",
      `... [truncated ${value.length - head - tail} chars] ...`,
      "",
      value.slice(-tail),
    ].join("\n");
  }
}


import path from "path";

export class ArtifactNormalizer {
  normalize(artifact) {
    return {
      ...artifact,
      title: this.normalizeText(artifact.title),
      goal: this.normalizeText(artifact.goal),
      notes: this.normalizeNotes(artifact.notes),
      outputs: this.normalizeOutputs(artifact.outputs ?? [], artifact),
      updatedAt: new Date().toISOString(),
    };
  }

  normalizeText(value) {
    return String(value ?? "").trim();
  }

  normalizeNotes(notes) {
    if (Array.isArray(notes)) {
      return notes.map((item) => String(item).trim()).filter(Boolean);
    }

    if (notes) {
      return [String(notes).trim()];
    }

    return [];
  }

  normalizeOutputs(outputs, artifact) {
    return outputs.map((output) => this.normalizeOutput(output, artifact));
  }

  normalizeOutput(output, artifact) {
    let normalizedPath = this.normalizeOutputPath(output.path);
    
    // 如果 path 沒有副檔名,嘗試從 artifact goal 推斷
    if (!path.extname(normalizedPath)) {
      normalizedPath = this.inferPathExtension(normalizedPath, artifact);
    }

    const normalizedLanguage = this.normalizeLanguage(output.language, normalizedPath);

    return {
      ...output,
      kind: output.kind ?? "file",
      path: normalizedPath,
      language: normalizedLanguage,
      content: this.stripMarkdownCodeFence(output.content ?? ""),
    };
  }

  normalizeOutputPath(filePath = "") {
    return String(filePath)
      .trim()
      .replaceAll("\\", "/")
      .replace(/^\/+/, "");
  }

  inferPathExtension(filePath, artifact) {
    // 如果已經有副檔名,不處理
    if (path.extname(filePath)) {
      return filePath;
    }

    const goal = String(artifact?.goal ?? "").toLowerCase();
    const basename = path.basename(filePath);

    // 檢查 goal 是否提到 Java class/record/interface
    if (goal.includes("java")) {
      // 檢查是否提到明確的類別名稱
      const classMatch = goal.match(/名稱為\s*(\w+)/);
      
      if (classMatch && classMatch[1]) {
        const className = classMatch[1];
        
        // 如果 basename 已經是類別名稱,直接加 .java
        if (basename === className) {
          return `${filePath}.java`;
        }
        
        // 如果 basename 是空的或不符合,用類別名稱
        if (!basename || basename === "output") {
          return `${className}.java`;
        }
      }
      
      // fallback: 加 .java
      return `${filePath}.java`;
    }

    return filePath;
  }

  normalizeLanguage(language, filePath) {
    const value = String(language ?? "").trim().toLowerCase();

    if (value) return value;

    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".java") return "java";
    if (ext === ".js") return "javascript";
    if (ext === ".ts") return "typescript";
    if (ext === ".md") return "markdown";
    if (ext === ".sql") return "sql";
    if (ext === ".json") return "json";
    if (ext === ".yaml" || ext === ".yml") return "yaml";
    if (ext === ".properties") return "properties";
    if (ext === ".xml") return "xml";

    return "text";
  }

  stripMarkdownCodeFence(text = "") {
    let content = String(text).trim();

    // 移除最外層的 markdown code fence
    // 支援 ```java、```sql、```xml、```json 等
    const fenceMatch = content.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/);
    
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }

    // Fallback: 移除開頭與結尾的 ```
    content = content.replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, "");
    content = content.replace(/\n?```\s*$/i, "");

    return content.trim();
  }
}

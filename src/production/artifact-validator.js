import path from "path";
import { getArtifactTypePolicy } from "./artifact-type-policy.js";

export class ArtifactValidator {
  validate(artifact) {
    this.validateBasicArtifact(artifact);
    this.validateOutputs(artifact);
    this.validateGoalFidelity(artifact);
    this.validateTextQuality(artifact);
  }

  validateBasicArtifact(artifact) {
    if (!artifact.type) {
      throw new Error("Artifact type is required.");
    }

    if (!artifact.title) {
      throw new Error("Artifact title is required.");
    }

    if (!artifact.goal) {
      throw new Error("Artifact goal is required.");
    }

    if (!Array.isArray(artifact.outputs)) {
      throw new Error("Artifact outputs must be an array.");
    }

    if (artifact.outputs.length === 0) {
      throw new Error("Artifact must contain at least one output.");
    }
  }

  validateOutputs(artifact) {
    const policy = getArtifactTypePolicy(artifact.type);

    for (const output of artifact.outputs) {
      this.validateOutputPath(output);
      this.validateOutputLanguage(output, policy);
      this.validateOutputExtension(output, policy);
      this.validateOutputContent(output, artifact.type);
    }
  }

  validateGoalFidelity(artifact) {
    const goal = String(artifact.goal ?? "").toLowerCase();
    const outputs = artifact.outputs ?? [];

    // 抽取 goal 中的明確需求詞
    const requirements = this.extractRequirements(goal);

    for (const requirement of requirements) {
      const found = outputs.some((output) => {
        const pathLower = String(output.path ?? "").toLowerCase();
        const contentLower = String(output.content ?? "").toLowerCase();
        
        return pathLower.includes(requirement.term) || contentLower.includes(requirement.term);
      });

      if (!found && requirement.required) {
        throw new Error(
          `Goal Fidelity violation: required term "${requirement.term}" not found in outputs. Goal: ${artifact.goal}`
        );
      }
    }
  }

  extractRequirements(goal) {
    const requirements = [];

    // Java class/record/interface 名稱
    const nameMatch = goal.match(/名稱為\s*(\w+)/);
    if (nameMatch) {
      requirements.push({
        term: nameMatch[1].toLowerCase(),
        required: true,
        type: "name",
      });
    }

    // 方法名稱
    const methodMatches = [
      ...goal.matchAll(/包含\s*(\w+)\s*方法/g),
      ...goal.matchAll(/(\w+)\s*\(\s*[^)]*\s*\)\s*方法/g),
    ];

    for (const match of methodMatches) {
      if (match[1]) {
        requirements.push({
          term: match[1].toLowerCase(),
          required: true,
          type: "method",
        });
      }
    }

    // 欄位名稱
    const fieldMatch = goal.match(/欄位包含\s*([\w,\s]+)/);
    if (fieldMatch) {
      const fields = fieldMatch[1].split(/[,\s]+/).filter(Boolean);
      for (const field of fields) {
        requirements.push({
          term: field.toLowerCase(),
          required: true,
          type: "field",
        });
      }
    }

    // 回傳值
    const returnMatch = goal.match(/回傳\s*([\w\s]+)/);
    if (returnMatch) {
      const returnValue = returnMatch[1].trim();
      if (returnValue) {
        requirements.push({
          term: returnValue.toLowerCase(),
          required: false, // 回傳值可能在字串中,不強制要求
          type: "return",
        });
      }
    }

    return requirements;
  }

  validateTextQuality(artifact) {
    this.checkSimplifiedChinese(artifact.title, "title");
    this.checkSimplifiedChinese(artifact.goal, "goal");

    for (const note of artifact.notes ?? []) {
      this.checkSimplifiedChinese(note, "note");
    }
  }

  checkSimplifiedChinese(text, fieldName) {
    const textStr = String(text ?? "");

    // 檢查明顯的簡體中文字
    const simplifiedChars = [
      "电", "脑", "计", "线", "际", "网", "讯", "询", "处", "应",
      "说", "请", "让", "这", "那", "您", "们", "来", "吗", "呢",
      "时", "间", "为", "动", "关", "於", "个", "对", "与", "开",
      "从", "让", "远", "进", "还", "这", "边", "么", "呀", "啊",
      "儿", "当", "啦", "钱", "块", "书", "样", "么", "没",
    ];

    for (const char of simplifiedChars) {
      if (textStr.includes(char)) {
        throw new Error(
          `Text quality violation: field "${fieldName}" contains simplified Chinese character: ${char}`
        );
      }
    }

    // 檢查亂碼中文 (UTF-8 錯誤轉換)
    const garbagePattern = /[\u00C0-\u00FF]{2,}/;
    if (garbagePattern.test(textStr)) {
      throw new Error(
        `Text quality violation: field "${fieldName}" contains garbled text`
      );
    }
  }

  validateOutputPath(output) {
    if (output.kind !== "file") return;

    if (!output.path) {
      throw new Error("Output file path is required.");
    }

    if (path.isAbsolute(output.path)) {
      throw new Error(`Output path must be relative: ${output.path}`);
    }

    if (output.path.includes("..")) {
      throw new Error(`Output path cannot contain '..': ${output.path}`);
    }

    const ext = path.extname(output.path);

    if (!ext) {
      throw new Error(`Output path must include file extension: ${output.path}`);
    }
  }

  validateOutputLanguage(output, policy) {
    if (!policy.allowedLanguages?.length) return;

    const language = String(output.language ?? "").toLowerCase();

    if (!policy.allowedLanguages.includes(language)) {
      throw new Error(
        `Invalid output language: ${language}. Allowed: ${policy.allowedLanguages.join(", ")}`
      );
    }
  }

  validateOutputExtension(output, policy) {
    if (!policy.allowedExtensions?.length) return;

    const ext = path.extname(output.path).toLowerCase();

    if (!policy.allowedExtensions.includes(ext)) {
      throw new Error(
        `Invalid output extension: ${output.path}. Allowed: ${policy.allowedExtensions.join(", ")}`
      );
    }
  }

  validateOutputContent(output, artifactType) {
    const language = String(output.language ?? "").toLowerCase();
    const content = String(output.content ?? "").trim();

    if (!content) {
      throw new Error(`Output content is empty: ${output.path}`);
    }

    if (artifactType === "code") {
      this.validateCodeContent(output, language, content);
    }

    if (artifactType === "document") {
      this.validateDocumentContent(output, language, content);
    }

    if (artifactType === "sql") {
      this.validateSqlContent(output, language, content);
    }

    if (artifactType === "executable-java") {
      this.validateExecutableJavaContent(output, content);
    }
  }

  validateCodeContent(output, language, content) {
    if (language === "java") {
      this.validateJavaContent(output, content);
    }

    if (language === "javascript") {
      const looksLikeJavaScript =
        content.includes("function ") ||
        content.includes("export ") ||
        content.includes("const ") ||
        content.includes("class ");

      if (!looksLikeJavaScript) {
        throw new Error(`JavaScript output does not look like JavaScript code: ${output.path}`);
      }
    }

    if (language === "json") {
      try {
        JSON.parse(content);
      } catch {
        throw new Error(`JSON output is not valid JSON: ${output.path}`);
      }
    }
  }

  validateJavaContent(output, content) {
    const trimmed = content.trim();

    if (trimmed.startsWith("#!")) {
      throw new Error(`Java file must not start with shebang: ${output.path}`);
    }

    if (trimmed.startsWith("<?xml")) {
      throw new Error(`Java file contains XML content: ${output.path}`);
    }

    if (trimmed.startsWith("{")) {
      throw new Error(`Java file contains JSON content: ${output.path}`);
    }

    if (trimmed.includes("```")) {
      throw new Error(`Java file must not contain markdown code fence: ${output.path}`);
    }

    const looksLikeJava =
      trimmed.includes("class ") ||
      trimmed.includes("interface ") ||
      trimmed.includes("enum ") ||
      trimmed.includes("@SpringBootApplication") ||
      trimmed.includes("package ");

    if (!looksLikeJava) {
      throw new Error(`Java output does not look like Java code: ${output.path}`);
    }
  }

  validateDocumentContent(output, language, content) {
    if (language !== "markdown") {
      throw new Error(`Document output must be markdown: ${output.path}`);
    }

    if (!content.includes("#")) {
      throw new Error(`Markdown document should contain heading: ${output.path}`);
    }
  }

  validateSqlContent(output, language, content) {
    if (language !== "sql") {
      throw new Error(`SQL artifact output must use sql language: ${output.path}`);
    }

    const upper = content.toUpperCase();

    const looksLikeSql =
      upper.includes("CREATE ") ||
      upper.includes("ALTER ") ||
      upper.includes("INSERT ") ||
      upper.includes("SELECT ");

    if (!looksLikeSql) {
      throw new Error(`SQL output does not look like SQL: ${output.path}`);
    }
  }

  validateExecutableJavaContent(output, content) {
    const className = path.basename(output.path, ".java");

    // 檢查 public class 名稱與檔名一致
    if (!content.includes(`class ${className}`)) {
      throw new Error(
        `Executable Java public class must match file name. Expected class ${className} in ${output.path}`
      );
    }

    // 檢查包含 main 方法
    if (!content.includes("public static void main(String[] args)")) {
      throw new Error(
        `Executable Java must contain main method: ${output.path}`
      );
    }

    // 檢查是否包含 markdown code fence (應該在 normalizer 已移除)
    if (content.includes("```")) {
      throw new Error(
        `Executable Java must not contain markdown code fence: ${output.path}`
      );
    }
  }
}

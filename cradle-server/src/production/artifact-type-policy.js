export const ARTIFACT_TYPE_POLICIES = {
  document: {
    description: "Markdown document only.",
    allowedLanguages: ["markdown"],
    allowedExtensions: [".md"],
    outputRule:
      "type=document 時，outputs 只能產生 Markdown 文件，不可產生 Java、SQL、JSON、YAML、properties 或其他程式碼檔案。",
  },

  code: {
    description: "Source code and the minimum files required by the requested runtime.",
    allowedLanguages: [
      "javascript",
      "typescript",
      "java",
      "python",
      "go",
      "rust",
      "shell",
      "html",
      "css",
      "sql",
      "json",
      "yaml",
      "properties",
      "xml",
      "markdown",
    ],
    allowedExtensions: [
      ".js",
      ".ts",
      ".java",
      ".py",
      ".go",
      ".rs",
      ".sh",
      ".html",
      ".css",
      ".sql",
      ".json",
      ".yaml",
      ".yml",
      ".properties",
      ".xml",
      ".md",
    ],
    outputRule: `type=code 時，可以產生任意明確要求的程式語言、設定檔與 README，但每個檔案必須是完整可落檔內容。
只有 Goal 或 Environment 明確要求 Spring Boot 時才套用 Spring Boot 專案結構；不可把 Java、Maven 或 Spring 當成預設技術棧。

【檔案路徑規則】
- 每個 output.path 必須包含正確副檔名(.java、.xml、.yml、.md 等)
- 只有 Goal 要求標準 Java 專案時，Java 檔案才放在 src/main/java/{package_path}/
- 只有 Goal 要求標準 Java 專案時，設定檔才放在 src/main/resources/
- 其他語言與專案結構必須忠實遵守 Goal，不可套用 Java 目錄慣例
- 不可使用絕對路徑或 .. 跳出專案目錄

【內容與語言一致性】
- Java 檔案 (language=java) content 必須是 Java 程式碼,不可放 JSON 或其他格式
- JSON 檔案 (language=json) content 必須是合法 JSON,不可放 Java 程式碼
- Markdown 檔案 (language=markdown) content 必須是 Markdown 格式
- XML 檔案 (language=xml) content 必須是合法 XML`,
  },

  diagram: {
    description: "Diagram document.",
    allowedLanguages: ["markdown", "mermaid", "plantuml"],
    allowedExtensions: [".md", ".mmd", ".puml"],
    outputRule:
      "type=diagram 時，outputs 應優先產生 Mermaid markdown 或 PlantUML，不可產生應用程式原始碼。",
  },

  image: {
    description: "A directly renderable vector image.",
    allowedLanguages: ["svg"],
    allowedExtensions: [".svg"],
    outputRule:
      "type=image 目前產生一個可直接渲染的 SVG 圖片。SVG 必須自包含、不得引用外部資源、不得包含 script、foreignObject 或事件處理器。不可用 Markdown 圖片說明冒充圖片 Artifact。",
  },

  sql: {
    description: "SQL script only.",
    allowedLanguages: ["sql"],
    allowedExtensions: [".sql"],
    outputRule:
      "type=sql 時，outputs 只能產生 SQL script，不可產生 Java 或 Markdown 設計文件。",
  },

  config: {
    description: "Configuration files.",
    allowedLanguages: ["json", "yaml", "properties", "env"],
    allowedExtensions: [".json", ".yaml", ".yml", ".properties", ".env"],
    outputRule:
      "type=config 時，outputs 只能產生設定檔。",
  },

  test: {
    description: "Executable or machine-readable test assets.",
    allowedLanguages: ["javascript", "typescript", "java", "python", "go", "rust", "shell", "json", "yaml", "markdown"],
    allowedExtensions: [".js", ".ts", ".java", ".py", ".go", ".rs", ".sh", ".json", ".yaml", ".yml", ".md"],
    outputRule: "type=test 時，產生符合 Goal 技術環境的測試程式、fixture 或測試說明，不得預設為 Java。",
  },

  prompt: markdownPolicy("Prompt artifact."),
  decision: markdownPolicy("Decision record."),
  research: markdownPolicy("Evidence-backed research document."),
  spec: markdownPolicy("Specification document."),
  task: markdownPolicy("Structured task document."),

  "executable-java": {
    description: "Single-file executable Java source.",
    allowedLanguages: ["java"],
    allowedExtensions: [".java"],
    outputRule: `type=executable-java 時，必須產生一個可以直接使用 javac 編譯並執行的單檔 Java 程式。

【必要條件】
- 只能產生一個 .java 檔案
- 該 Java 檔案必須包含 public static void main(String[] args) 方法
- public class 名稱必須與檔名一致 (例如 HelloService.java 必須包含 public class HelloService)
- 不可依賴 Spring Boot、Maven、Gradle 或外部套件
- 不可使用 import 引入外部 library (除了 java.lang.* 以外的標準函式庫需明確列出)

【執行方式】
可以直接使用以下指令執行:
\`\`\`bash
javac ClassName.java
java ClassName
\`\`\`

【範例】
正確的 executable-java artifact 應該類似:
\`\`\`java
public class HelloService {
    
    public String sayHello() {
        return "Hello Cradle";
    }
    
    public static void main(String[] args) {
        HelloService service = new HelloService();
        System.out.println(service.sayHello());
    }
}
\`\`\`

【禁止】
- 多個 .java 檔案
- 需要 Maven/Gradle 編譯
- 使用 Spring Boot annotations
- 依賴外部 JAR`,
  },

  generic: {
    description: "Generic artifact.",
    allowedLanguages: [],
    allowedExtensions: [],
    outputRule:
      "type=generic 時，可以根據需求產生合理 artifact，但仍需保持 outputs 類型一致。",
  },
};

function markdownPolicy(description) {
  return {
    description,
    allowedLanguages: ["markdown"],
    allowedExtensions: [".md"],
    outputRule: "此 Artifact 類型必須產生一份或多份可直接保存的 Markdown 文件，並保留 Goal、假設與證據邊界。",
  };
}

export function getArtifactTypePolicy(type = "generic") {
  return ARTIFACT_TYPE_POLICIES[type] ?? ARTIFACT_TYPE_POLICIES.generic;
}

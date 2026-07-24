export function createPerceptionPrompt({
  memoryContext,
  stimuli,
}) {
  return `
        請根據目前的 Cell DNA、Memory、Vision、Environment,觀察以下 situation stimuli。

        請產生一份 Observation,包含：

        - 觀察摘要
        - 對目前 Cell 的影響
        - 可能牽動的 DNA trait
        - 建議下一步行動

        # Cell Context

        ${memoryContext}

        # Stimuli

        ${stimuli.map((s) => `
        ## ${s.category}/${s.file}

        ${s.content}
        `).join("\n\n")}
        `;
}

export function createWorkspaceWritePrompt(content) {
  return `
        請根據以下任務產生一份 Markdown 文件內容。

        任務：
        ${content}

        請只輸出 Markdown 內容，不要額外解釋。
        `;
}

export function createWorkspaceRevisionPrompt({
  task,
  originalContent,
}) {
  return `
        請根據修改任務，重寫以下 Markdown 文件。

        請遵守：
        - 只輸出修改後的 Markdown 文件內容
        - 不要輸出說明
        - 不要包在 \`\`\`markdown code fence 裡
        - 不要新增目前系統尚未實作的能力

        # 修改任務

        ${task}

        ---

        # 原始文件

        ${originalContent}
        `;
}

export function createInboxDigestPrompt(inbox) {
  return `
        請整理以下 inbox 訊息，輸出成 Markdown。

        請包含：
        - 重點摘要
        - 可能任務
        - 需要回應的對象
        - 下一步建議

        # Inbox

        ${JSON.stringify(inbox, null, 2)}
        `;
}

export function createTaskArtifactPrompt(task) {
  return `
        請根據以下 Task 產出一份 Markdown 工作成果。

        請只輸出 Markdown，不要額外解釋。

        # Task

        ${JSON.stringify(task, null, 2)}
        `;
}

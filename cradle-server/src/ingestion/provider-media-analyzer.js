import { createLLMProvider } from "../providers/llm-provider-factory.js";
import { parseLooseJsonObject } from "../utils/json.js";
import { abortReason, throwIfAborted } from "../utils/abort.js";

const MEDIA_ANALYSIS_PROMPT = `
Observe the attached image as source material for a software-life Cell.

Return JSON only:
{
  "summary": "one factual visual summary",
  "visibleText": ["text visibly present in the image"],
  "visualElements": ["factual objects, layout, colors, symbols or diagram relations"],
  "uncertainties": ["details that cannot be determined safely"]
}

Rules:
- Describe only what is visually observable.
- Do not infer hidden intent, requirements, identity, ownership or correctness.
- Do not inspect repository files or use tools.
- Keep uncertainty explicit.
`.trim();

export class ProviderMediaAnalyzer {
  constructor({
    providerFactory = createLLMProvider,
    resolveBinding = () => ({ provider: "codex", model: "auto" }),
  } = {}) {
    this.providerFactory = providerFactory;
    this.resolveBinding = resolveBinding;
  }

  async analyze({ source, bytes, provider, model, signal = null } = {}) {
    throwIfAborted(signal);
    const binding = {
      ...this.resolveBinding(),
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    };
    let adapter;
    try {
      adapter = await this.providerFactory(binding);
      if (adapter.capabilities?.mediaInput !== true) {
        return unavailable(
          `Provider ${binding.provider} does not support image analysis`,
          binding,
        );
      }
      const response = await adapter.ask({
        prompt: MEDIA_ANALYSIS_PROMPT,
        media: [{
          name: source.originalName,
          mediaType: source.mediaType,
          data: Buffer.from(bytes),
        }],
      }, { signal });
      const observation = normalizeObservation(parseLooseJsonObject(response));
      if (!observation.summary && observation.visibleText.length === 0 && observation.visualElements.length === 0) {
        return unavailable("Image analysis returned no observable content", binding);
      }
      return {
        status: "analyzed",
        text: formatObservation(observation),
        metadata: {
          provider: adapter.name,
          model: adapter.model,
          visibleTextCount: observation.visibleText.length,
          visualElementCount: observation.visualElements.length,
          uncertaintyCount: observation.uncertainties.length,
        },
        evidence: {
          outcome: "sufficient",
          reason: `Visual content observed by ${adapter.name}/${adapter.model}`,
          method: "provider-media-analysis-v1",
        },
      };
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      return unavailable(error?.message ?? "Image analysis failed", binding, "error");
    } finally {
      try {
        await adapter?.cleanup?.();
      } catch {
        // Provider cleanup cannot replace the perception result.
      }
    }
  }
}

function normalizeObservation(value = {}) {
  return {
    summary: String(value.summary ?? "").trim().slice(0, 2_000),
    visibleText: normalizeList(value.visibleText),
    visualElements: normalizeList(value.visualElements),
    uncertainties: normalizeList(value.uncertainties),
  };
}

function normalizeList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((item) => String(item).trim()).filter(Boolean).slice(0, 50);
}

function formatObservation(observation) {
  const sections = [];
  if (observation.summary) sections.push(`Visual summary: ${observation.summary}`);
  if (observation.visibleText.length > 0) {
    sections.push(`Visible text:\n${observation.visibleText.map((item) => `- ${item}`).join("\n")}`);
  }
  if (observation.visualElements.length > 0) {
    sections.push(`Visual elements:\n${observation.visualElements.map((item) => `- ${item}`).join("\n")}`);
  }
  if (observation.uncertainties.length > 0) {
    sections.push(`Uncertainties:\n${observation.uncertainties.map((item) => `- ${item}`).join("\n")}`);
  }
  return sections.join("\n\n").slice(0, 200_000);
}

function unavailable(reason, binding, outcome = "insufficient_evidence") {
  return {
    status: "unavailable",
    text: "",
    metadata: { provider: binding.provider, model: binding.model },
    evidence: { outcome, reason, method: "provider-media-analysis-v1" },
  };
}

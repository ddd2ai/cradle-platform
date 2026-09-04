import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath } from "node:url";
import { abortReason, throwIfAborted } from "../utils/abort.js";

const MAX_EXTRACTED_CHARACTERS = 200_000;
const MAX_PDF_PAGES = 100;
const STANDARD_FONT_DATA_URL = fileURLToPath(new URL(
  ".",
  import.meta.resolve("pdfjs-dist/standard_fonts/FoxitSans.pfb"),
));

export class DocumentExtractorRegistry {
  constructor({ extractors, mediaAnalyzer = null } = {}) {
    this.extractors = extractors ?? defaultExtractors({ mediaAnalyzer });
  }

  async extract({ source, bytes, context = {}, signal = null } = {}) {
    throwIfAborted(signal);
    const extractor = this.extractors.find((candidate) => candidate.supports(source?.mediaType));
    if (!extractor) {
      return extractionUnavailable("No extractor is registered for this media type");
    }
    try {
      return normalizeExtraction(
        await extractor.extract({ source, bytes, context, signal }),
        extractor.name,
      );
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      return {
        status: "failed",
        method: extractor.name,
        text: "",
        metadata: {},
        evidence: {
          outcome: "error",
          reason: error?.message ?? "Document extraction failed",
        },
      };
    }
  }
}

export class TextDocumentExtractor {
  name = "utf8-text-v1";

  supports(mediaType) {
    return mediaType?.startsWith("text/") || [
      "application/json",
      "application/xml",
      "image/svg+xml",
    ].includes(mediaType);
  }

  async extract({ bytes, signal }) {
    throwIfAborted(signal);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return {
      status: "extracted",
      text: text.slice(0, MAX_EXTRACTED_CHARACTERS),
      metadata: { truncated: text.length > MAX_EXTRACTED_CHARACTERS },
      evidence: { outcome: "sufficient", reason: "UTF-8 content decoded deterministically" },
    };
  }
}

export class PdfDocumentExtractor {
  name = "pdfjs-text-v1";

  supports(mediaType) {
    return mediaType === "application/pdf";
  }

  async extract({ bytes, signal }) {
    throwIfAborted(signal);
    const loadingTask = getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useWorkerFetch: false,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    });
    const onAbort = () => { void loadingTask.destroy(); };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const document = await loadingTask.promise;
      throwIfAborted(signal);
      const pageCount = document.numPages;
      const pages = Math.min(pageCount, MAX_PDF_PAGES);
      const pageTexts = [];
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        throwIfAborted(signal);
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pageTexts.push(content.items.map((item) => item.str ?? "").join(" ").trim());
        page.cleanup();
      }
      const text = pageTexts.filter(Boolean).join("\n\n");
      if (!text) {
        return {
          status: "metadata-only",
          text: "",
          metadata: { pageCount, processedPages: pages },
          evidence: {
            outcome: "insufficient_evidence",
            reason: "PDF contains no machine-readable text; OCR is not configured",
          },
        };
      }
      return {
        status: "extracted",
        text: text.slice(0, MAX_EXTRACTED_CHARACTERS),
        metadata: {
          pageCount,
          processedPages: pages,
          truncated: text.length > MAX_EXTRACTED_CHARACTERS || pageCount > pages,
        },
        evidence: { outcome: "sufficient", reason: "PDF text layer extracted with PDF.js" },
      };
    } finally {
      signal?.removeEventListener("abort", onAbort);
      await loadingTask.destroy();
    }
  }
}

export class ImageDocumentExtractor {
  name = "image-metadata-v1";

  constructor({ mediaAnalyzer = null } = {}) {
    this.mediaAnalyzer = mediaAnalyzer;
    if (mediaAnalyzer) this.name = "provider-media-analysis-v1";
  }

  supports(mediaType) {
    return mediaType?.startsWith("image/") && mediaType !== "image/svg+xml";
  }

  async extract({ source, bytes, context, signal }) {
    throwIfAborted(signal);
    const imageMetadata = readImageMetadata(source.mediaType, bytes);
    if (this.mediaAnalyzer) {
      const analysis = await this.mediaAnalyzer.analyze({
        source,
        bytes,
        provider: context?.provider,
        model: context?.model,
        signal,
      });
      if (analysis.evidence?.outcome === "sufficient") {
        return {
          ...analysis,
          status: "extracted",
          metadata: { ...imageMetadata, ...analysis.metadata },
        };
      }
      return {
        status: "metadata-only",
        text: "",
        metadata: { ...imageMetadata, ...analysis.metadata },
        evidence: analysis.evidence,
      };
    }
    return {
      status: "metadata-only",
      text: "",
      metadata: imageMetadata,
      evidence: {
        outcome: "insufficient_evidence",
        reason: "Image was preserved, but no media analyzer is configured",
      },
    };
  }
}

function defaultExtractors({ mediaAnalyzer } = {}) {
  return [
    new TextDocumentExtractor(),
    new PdfDocumentExtractor(),
    new ImageDocumentExtractor({ mediaAnalyzer }),
  ];
}

function normalizeExtraction(value = {}, method) {
  return {
    status: value.status ?? "extracted",
    method,
    text: String(value.text ?? ""),
    metadata: value.metadata ?? {},
    evidence: value.evidence ?? {
      outcome: value.text ? "sufficient" : "insufficient_evidence",
      reason: value.text ? "Content extracted" : "No content extracted",
    },
  };
}

function extractionUnavailable(reason) {
  return {
    status: "unsupported",
    method: null,
    text: "",
    metadata: {},
    evidence: { outcome: "insufficient_evidence", reason },
  };
}

function readImageMetadata(mediaType, bytes) {
  if (mediaType === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mediaType === "image/gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  return {};
}

import { createHash } from "node:crypto";

const MAX_DECLARED_SYMBOLS = 256;
const MAX_INDEXED_TERMS = 64;

export function buildArtifactOutputIndex({ content = "", indexedTerms = [] } = {}) {
  const terms = normalizeTerms(indexedTerms);
  const indexed = terms.slice(0, MAX_INDEXED_TERMS);
  const normalizedContent = String(content).toLowerCase();
  return {
    declaredSymbols: extractDeclaredSymbols(content).slice(0, MAX_DECLARED_SYMBOLS),
    contentBytes: Buffer.byteLength(String(content), "utf8"),
    contentTermHashes: indexed
      .filter((term) => normalizedContent.includes(term))
      .map(hashContentTerm),
    contentTermIndexKey: buildContentTermIndexKey(terms),
    contentTermIndexComplete: terms.length <= MAX_INDEXED_TERMS,
  };
}

export function hasIndexedContentTerm(output, term) {
  return (output?.contentTermHashes ?? []).includes(hashContentTerm(term));
}

export function hashContentTerm(term) {
  return createHash("sha256")
    .update(String(term).trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export function buildContentTermIndexKey(terms = []) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeTerms(terms)))
    .digest("hex")
    .slice(0, 16);
}

export function extractDeclaredSymbols(content = "") {
  const symbols = [];
  const seen = new Set();
  const patterns = [
    /\b(?:class|interface|record|enum|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:public|protected|private)\s+(?:(?:static|async|final|synchronized|abstract|native|default)\s+)*(?:[A-Za-z_$][\w$<>, ?\[\]]*\s+)?([A-Za-z_$][\w$]*)\s*\(/g,
  ];
  for (const pattern of patterns) {
    for (const match of String(content).matchAll(pattern)) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        symbols.push(match[1]);
      }
      if (symbols.length >= MAX_DECLARED_SYMBOLS) return symbols;
    }
  }
  return symbols;
}

function normalizeTerms(terms) {
  return [...new Set(
    terms
      .map((term) => String(term).trim().toLowerCase())
      .filter(Boolean)
  )].sort();
}

const DNA_FACTORS = [
  "PER",
  "DEC",
  "DEP",
  "LEA",
  "COL",
  "CRE",
  "EVO",
  "REF",
];

export function listDNAFactors() {
  return DNA_FACTORS;
}

export function isValidDNAFactor(factor) {
  return DNA_FACTORS.includes(
    String(factor).toUpperCase()
  );
}

export function projectDNA(
  dna,
  axisX,
  axisY,
) {
  return {
    x: dna[axisX] ?? 0,
    y: dna[axisY] ?? 0,
  };
}

export const CJ_MASS_IMPORT_MAX_SKUS = 50;

export function getCjMassImportSkuEntries(skuText: string): string[] {
  return Array.from(new Set(
    skuText
      .split(/[\n,]+/)
      .map(value => value.trim().toUpperCase())
      .filter(Boolean),
  ));
}

export function isValidCjMassImportSize(skuText: string): boolean {
  const entries = getCjMassImportSkuEntries(skuText);
  return entries.length > 0 && entries.length <= CJ_MASS_IMPORT_MAX_SKUS;
}

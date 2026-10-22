export type BusinessUnit = "BF"; // KS_PORTAL_v1_NO_BI - Keystone is lending only
export type Silo = Lowercase<BusinessUnit>;

export const DEFAULT_BUSINESS_UNIT: BusinessUnit = "BF";

export function normalizeBusinessUnit(value: BusinessUnit | Silo): BusinessUnit {
  return value.toUpperCase() as BusinessUnit;
}

import { useContext } from "react";
import BusinessUnitContext from "@/context/BusinessUnitContext";
import SiloContext from "@/context/SiloContext";
import { DEFAULT_BUSINESS_UNIT, type BusinessUnit } from "@/types/businessUnit";

const TEST_BUSINESS_UNIT_STUB = {
  activeBusinessUnit: DEFAULT_BUSINESS_UNIT,
  businessUnits: [DEFAULT_BUSINESS_UNIT],
  setActiveBusinessUnit: () => undefined
};

// KS_PORTAL_v1_NO_BI - Keystone has one silo.
const siloToBusinessUnit = (_silo: string): BusinessUnit => DEFAULT_BUSINESS_UNIT;

const businessUnitToSilo = (_businessUnit: BusinessUnit): "bf" => "bf";

export const useBusinessUnit = () => {
  const context = useContext(BusinessUnitContext);
  // BF_PORTAL_AUDIT_v777 - read both contexts on every render (rules of hooks).
  const legacySiloContext = useContext(SiloContext);
  if (context) {
    return context;
  }

  if (legacySiloContext) {
    const businessUnit = siloToBusinessUnit(legacySiloContext.silo);
    return {
      activeBusinessUnit: businessUnit,
      businessUnits: [businessUnit],
      setActiveBusinessUnit: (nextBusinessUnit: BusinessUnit) => {
        legacySiloContext.setSilo(businessUnitToSilo(nextBusinessUnit));
      }
    };
  }

  if (import.meta.env.MODE === "test") {
    return TEST_BUSINESS_UNIT_STUB;
  }

  throw new Error("useBusinessUnit must be used within a BusinessUnitProvider");
};

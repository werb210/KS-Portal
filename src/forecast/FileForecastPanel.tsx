// KS_PORTAL_v23_FORECAST - on an application: when staff expect it to close, and its forecast category (or "from the
// stage", which follows the stage's chance of funding). Only with the forecasting feature; silent otherwise.
import { useEffect, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import { CATEGORY_LABEL, forecastApi, type Category, type FileForecast } from "@/forecast/forecastApi";
import { hasFeature, usePlan } from "@/plans/planStore";

const input: CSSProperties = { padding: "4px 6px", borderRadius: 6, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", fontSize: 12 };

export default function FileForecastPanel({ applicationId }: { applicationId: string }) {
  const plan = usePlan();
  const allowed = hasFeature("forecasting", plan);
  const [f, setF] = useState<FileForecast | null>(null);
  useEffect(() => {
    if (!allowed || !applicationId) return;
    forecastApi.file(applicationId).then(setF).catch(() => setF(null));
  }, [allowed, applicationId]);
  if (!allowed || !f) return null;
  const save = async (patch: Parameters<typeof forecastApi.setFile>[1]) => {
    try { setF(await forecastApi.setFile(applicationId, patch)); }
    catch { try { toast.error("Could not save the forecast."); } catch { /* no toaster */ } }
  };
  return (
    <div data-testid="file-forecast" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "8px 20px", borderBottom: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", fontSize: 12, color: "var(--ui-text)" }}>
      <strong>Forecast</strong>
      <label>Expected close{" "}
        <input aria-label="Expected close date" type="date" style={input} value={f.expected_close_date ?? ""} onChange={(e) => void save({ expected_close_date: e.target.value || null })} />
      </label>
      <label>Category{" "}
        <select aria-label="Forecast category" style={input} value={f.forecast_category ?? ""} onChange={(e) => void save({ forecast_category: (e.target.value || null) as Category | null })}>
          <option value="">From the stage ({CATEGORY_LABEL[f.effective_category]})</option>
          <option value="commit">Commit</option><option value="best_case">Best case</option><option value="pipeline">Pipeline</option><option value="omit">Leave out</option>
        </select>
      </label>
      <span style={{ color: "var(--ui-text-muted)" }}>{f.stage}: {f.probability}% chance it funds</span>
    </div>
  );
}

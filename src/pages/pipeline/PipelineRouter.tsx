// KS_PORTAL_v1_NO_BI - Keystone has one silo, so the pipeline is always the lending pipeline.
// KS_HUBSPOT_GAPS_1_PIPELINES - with extra pipelines (Growth and Pro), a pipeline picker above the board: Lending shows
// the lending board unchanged; any other pipeline shows its own board.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PipelinePage from "@/pages/pipeline/PipelinePage";
import CustomPipelineBoard from "@/pipelines/CustomPipelineBoard";
import { LENDING_ID, usePipelines } from "@/pipelines/pipelinesApi";

export default function PipelineRouter() {
  const [reload, setReload] = useState(0);
  const list = usePipelines(reload);
  const [params, setParams] = useSearchParams();
  const extra = (list?.pipelines ?? []).filter((p) => !p.system && !p.archived_at);
  const wanted = params.get("pipeline") ?? LENDING_ID;
  const current = extra.find((p) => p.id === wanted) ?? null;
  if (!list?.feature || extra.length === 0) return <PipelinePage />;
  const pick = (id: string) => { const next = new URLSearchParams(params); if (id === LENDING_ID) next.delete("pipeline"); else next.set("pipeline", id); setParams(next, { replace: true }); };
  return (
    <div>
      <div role="tablist" aria-label="Pipelines" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 0 4px" }}>
        {[{ id: LENDING_ID, name: "Lending" }, ...extra].map((p) => {
          const active = (current?.id ?? LENDING_ID) === p.id;
          return (
            <button key={p.id} type="button" role="tab" aria-selected={active} onClick={() => pick(p.id)}
              className={active ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}>{p.name}</button>
          );
        })}
      </div>
      {current ? <div style={{ padding: 16 }}><h1 style={{ fontSize: 20, margin: "0 0 12px", color: "var(--ui-text)" }}>{current.name}</h1><CustomPipelineBoard pipeline={current} all={list.pipelines} onChanged={() => setReload((n) => n + 1)} /></div> : <PipelinePage />}
    </div>
  );
}

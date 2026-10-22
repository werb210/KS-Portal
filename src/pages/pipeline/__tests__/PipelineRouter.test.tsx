// KS_PORTAL_v1_NO_BI - Keystone has one silo: /pipeline always renders the lending pipeline.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/pages/pipeline/PipelinePage", () => ({
  default: () => <div data-testid="bf-pipeline">BF Pipeline</div>,
}));

import PipelineRouter from "../PipelineRouter";

describe("PipelineRouter", () => {
  it("renders the lending PipelinePage", () => {
    render(
      <MemoryRouter initialEntries={["/pipeline"]}>
        <Routes>
          <Route path="/pipeline" element={<PipelineRouter />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("bf-pipeline")).toBeInTheDocument();
  });
});

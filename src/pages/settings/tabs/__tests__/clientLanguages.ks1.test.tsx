// KS_CLIENT_LANGUAGES_v1 - Settings > Company > Client app languages.
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClientLanguages } from "../CompanySettings";

describe("client app languages", () => {
  it("keeps English on and adds French or Spanish in a fixed order", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ClientLanguages value="en" onChange={onChange} />);
    expect((screen.getByLabelText(/English/) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Spanish/));
    expect(onChange).toHaveBeenLastCalledWith("en,es");
    rerender(<ClientLanguages value="en,es" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/French/));
    expect(onChange).toHaveBeenLastCalledWith("en,fr,es");
    rerender(<ClientLanguages value="en,fr,es" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/French/));
    expect(onChange).toHaveBeenLastCalledWith("en,es");
  });
});

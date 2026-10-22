import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EMPTY_APPOINTMENTS, EMPTY_CALLS, EmptyState } from "@/components/dashboard/empty-state";

describe("dashboard empty states", () => {
  it("shows an honest empty call history", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, EMPTY_CALLS));
    expect(html).toContain("No demo calls yet");
    expect(html).toContain("Sample records are labelled");
  });

  it("shows an empty appointment list", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, EMPTY_APPOINTMENTS));
    expect(html).toContain("No appointment requests yet");
    expect(html).toContain("Nothing is confirmed");
  });
});

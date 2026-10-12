import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CrisisAlertBanner from "./CrisisAlertBanner";
import { CRISIS_RESOURCES } from "../constants/crisisResources";

describe("CrisisAlertBanner", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<CrisisAlertBanner isVisible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every shared crisis resource as a tel: link", () => {
    render(<CrisisAlertBanner isVisible severity="critical" />);
    for (const r of CRISIS_RESOURCES) {
      const link = screen.getByRole("link", { name: new RegExp(r.name.replace(/[()]/g, "\\$&")) });
      expect(link.getAttribute("href")).toBe(`tel:${r.phone.replace(/\s/g, "")}`);
    }
  });

  it("uses supportive language without clinical labels or confidence scores", () => {
    render(<CrisisAlertBanner isVisible severity="critical" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toMatch(/suicidal/i);
    expect(alert.textContent).not.toMatch(/confidence/i);
    expect(alert.textContent).not.toMatch(/\d+%/);
  });

  it("uses a polite status region for the high-risk variant", () => {
    render(<CrisisAlertBanner isVisible severity="high" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

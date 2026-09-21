import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Calendar } from "lucide-react";
import { STRINGS } from "../i18n";
import SummaryCard from "./SummaryCard";

// ---------------------------------------------------------------------------
// First React component test in the project — everything else under
// src/components/ is currently untested (only pure-function files have
// *.test.js siblings). SummaryCard was picked as the starting example
// because it's small, presentational, and used on every Dashboard tab, so
// a regression here (e.g. the delta arrow silently pointing the wrong way)
// would be easy to miss visually but easy to catch here.
// ---------------------------------------------------------------------------

const t = STRINGS.en;

describe("SummaryCard", () => {
  it("renders the label and value", () => {
    render(<SummaryCard icon={Calendar} label="Visits" value={42} t={t} />);
    expect(screen.getByText("Visits")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders a subValue when given", () => {
    render(<SummaryCard icon={Calendar} label="Avg deal" value="1,000 EGP" subValue="60 $" t={t} />);
    expect(screen.getByText("60 $")).toBeInTheDocument();
  });

  it("shows the no-comparison-data message when delta is explicitly null", () => {
    render(<SummaryCard icon={Calendar} label="Visits" value={10} delta={null} t={t} />);
    expect(screen.getByText(t.dashNoComparisonData)).toBeInTheDocument();
  });

  it("omits the delta row entirely when delta is left undefined (as opposed to explicitly null)", () => {
    render(<SummaryCard icon={Calendar} label="Visits" value={10} t={t} />);
    expect(screen.queryByText(t.dashNoComparisonData)).not.toBeInTheDocument();
  });

  it("renders a positive numeric delta as a plain percentage (sign comes from the arrow icon, not a + prefix)", () => {
    render(<SummaryCard icon={Calendar} label="Visits" value={10} delta={12.4} t={t} />);
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("renders a negative numeric delta as an absolute value (no minus sign in the text either)", () => {
    render(<SummaryCard icon={Calendar} label="Visits" value={10} delta={-8} t={t} />);
    expect(screen.getByText("8%")).toBeInTheDocument();
  });

  it("renders a points-based delta (used for win-rate comparisons) with the points suffix", () => {
    render(<SummaryCard icon={Calendar} label="Win rate" value="50%" delta={{ points: 5 }} t={t} />);
    expect(screen.getByText(`+5 ${t.dashPointsSuffix}`)).toBeInTheDocument();
  });
});

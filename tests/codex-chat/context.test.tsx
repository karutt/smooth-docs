import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { normalizeCodexContextUsage } from "../../src/codex-chat";
import { CodexContextUsageIndicator } from "../../themes/default/src/components/CodexContextUsage";

describe("Codex context usage", () => {
  it("uses the latest context size rather than cumulative billing tokens", () => {
    const usage = normalizeCodexContextUsage({
      total: { totalTokens: 900_000 }, last: { totalTokens: 25_000 }, modelContextWindow: 100_000,
    });
    expect(usage).toEqual({ usedTokens: 25_000, contextWindow: 100_000 });
    render(<CodexContextUsageIndicator usage={usage} />);
    expect(screen.getByRole("meter", { name: "Context usage" })).toHaveAttribute("aria-valuenow", "25");
  });

  it("does not invent a percentage when the backend has not reported a usable limit", () => {
    for (const value of [null, {}, { last: { totalTokens: 10 }, modelContextWindow: null },
      { last: { totalTokens: -1 }, modelContextWindow: 100 }, { last: { totalTokens: 10 }, modelContextWindow: 0 }]) {
      expect(normalizeCodexContextUsage(value)).toBeNull();
    }
    render(<CodexContextUsageIndicator usage={null} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("caps the graphic at 100 percent while retaining the reported token counts", () => {
    render(<CodexContextUsageIndicator usage={{ usedTokens: 150, contextWindow: 100 }} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "100");
    expect(meter).toHaveAttribute("aria-valuetext", "100% context used · 150 / 100 tokens");
  });
});

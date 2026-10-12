import { describe, expect, it } from "vitest";
import { evaluateCell, type CellMap } from "@/lib/formulas";

const grid: CellMap = {
  A1: { value: "1" },
  A2: { value: "2" },
  A3: { value: "3" },
  B1: { value: "hello" },
  B2: { value: "" },
  AA1: { value: "5" },
};

describe("evaluateCell", () => {
  it("returns plain values and arithmetic", () => {
    expect(evaluateCell(grid, "A1")).toBe("1");
    expect(evaluateCell({ A1: { formula: "=1+2" } }, "A1")).toBe("3");
    expect(evaluateCell({ A1: { formula: "=(2+3)*4" } }, "A1")).toBe("20");
    expect(evaluateCell({ A1: { formula: "=-5+2" } }, "A1")).toBe("-3");
    expect(evaluateCell({ A1: { formula: "=2*-3" } }, "A1")).toBe("-6");
  });

  it("evaluates cell references and the built-in functions", () => {
    expect(evaluateCell({ ...grid, C1: { formula: "=A1+A2" } }, "C1")).toBe("3");
    expect(evaluateCell({ ...grid, C1: { formula: "=SUM(A1:A3)" } }, "C1")).toBe("6");
    expect(evaluateCell({ ...grid, C1: { formula: "=AVERAGE(A1:A3)" } }, "C1")).toBe("2");
    expect(evaluateCell({ ...grid, C1: { formula: "=MIN(A1:A3)" } }, "C1")).toBe("1");
    expect(evaluateCell({ ...grid, C1: { formula: "=MAX(A1:A3)" } }, "C1")).toBe("3");
    expect(evaluateCell({ ...grid, C1: { formula: "=COUNT(A1:B2)" } }, "C1")).toBe("2");
    expect(evaluateCell({ ...grid, C1: { formula: "=SUM(A1, 2, A2:A3)" } }, "C1")).toBe("8");
    expect(evaluateCell({ ...grid, C1: { formula: "=SUM(A1:B1)" } }, "C1")).toBe("1");
    expect(evaluateCell({ AA1: { value: "5" }, A1: { formula: "=AA1*2" } }, "A1")).toBe("10");
    expect(evaluateCell({ A1: { formula: "=sum( 1 , 2 )" } }, "A1")).toBe("3");
  });

  it("reports errors for divide by zero, names, cycles, and empty aggregates", () => {
    expect(evaluateCell({ A1: { formula: "=1/0" } }, "A1")).toBe("#DIV/0");
    expect(evaluateCell({ A1: { formula: "=NOSUCH(1)" } }, "A1")).toBe("#NAME");
    expect(evaluateCell({ A1: { formula: "=B1:B2" } }, "A1")).toBe("#ERROR");
    expect(evaluateCell({ A1: { formula: "=AVERAGE(B1:B1)" }, B1: { value: "x" } }, "A1")).toBe("#DIV/0");
    expect(evaluateCell({ A1: { formula: "=MIN(B1)" }, B1: { value: "x" } }, "A1")).toBe("#VALUE");
    expect(evaluateCell({ A1: { formula: "=A1+1" } }, "A1")).toBe("#CYCLE");
    expect(
      evaluateCell(
        { A1: { formula: "=B1" }, B1: { formula: "=A1" } },
        "A1",
      ),
    ).toBe("#CYCLE");
    expect(evaluateCell({ A1: { formula: "=B1+1" }, B1: { value: "hi" } }, "A1")).toBe("#VALUE");
  });
});

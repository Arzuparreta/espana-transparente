import { describe, expect, it } from "vitest"
import {
  getIndicatorExplanation,
  getExplanationCodes,
  type IndicatorExplanation,
} from "./indicator-explanations"

describe("indicator-explanations", () => {
  describe("getExplanationCodes", () => {
    it("returns at least the three IPC indicators defined in the ETL", () => {
      const codes = getExplanationCodes()
      expect(codes).toContain("IPC")
      expect(codes).toContain("IPC_VAR_MENSUAL")
      expect(codes).toContain("IPC_VAR_ANUAL")
    })

    it("returns no duplicate codes", () => {
      const codes = getExplanationCodes()
      expect(new Set(codes).size).toBe(codes.length)
    })
  })

  describe("getIndicatorExplanation", () => {
    it("returns short, long, and implications for known codes", () => {
      for (const code of getExplanationCodes()) {
        const explanation = getIndicatorExplanation(code)
        expect(explanation.short).toBeTruthy()
        expect(explanation.short.length).toBeGreaterThan(0)
        expect(explanation.long).toBeTruthy()
        expect(explanation.long.length).toBeGreaterThan(0)
        expect(Array.isArray(explanation.implications)).toBe(true)
        expect(explanation.implications.length).toBeGreaterThanOrEqual(2)
        // Every implication is a non-empty string
        for (const imp of explanation.implications) {
          expect(typeof imp).toBe("string")
          expect(imp.length).toBeGreaterThan(0)
        }
      }
    })

    it("returns a valid shape for unknown codes", () => {
      const explanation = getIndicatorExplanation("NONEXISTENT_INDICATOR")
      expect(explanation.short).toBe("")
      expect(explanation.long).toBe("")
      expect(explanation.implications).toEqual([])
    })

    it("conforms to the IndicatorExplanation type at runtime", () => {
      const explanation: IndicatorExplanation = getIndicatorExplanation("IPC")
      expect(typeof explanation.short).toBe("string")
      expect(typeof explanation.long).toBe("string")
      expect(Array.isArray(explanation.implications)).toBe(true)
    })

    it("has no editorial language in any explanation field", () => {
      const forbidden = [
        /austriac/i,
        /libertari/i,
        /anarcocap/i,
        /coerci[óo]n/i,
        /\bmises\b/i,
        /\bhayek\b/i,
        /\brothbard\b/i,
        /expoli/i,
      ]
      for (const code of getExplanationCodes()) {
        const explanation = getIndicatorExplanation(code)
        const combined = [
          explanation.short,
          explanation.long,
          ...explanation.implications,
        ].join("\n")
        for (const pattern of forbidden) {
          expect(combined).not.toMatch(pattern)
        }
      }
    })
  })

  describe("IndicatorExplanation type shape", () => {
    it("accepts a valid explanation object", () => {
      const valid: IndicatorExplanation = {
        short: "Short description.",
        long: "Long description with more detail.",
        implications: ["Implication one.", "Implication two."],
      }
      expect(valid.short).toBeTruthy()
      expect(valid.long).toBeTruthy()
      expect(valid.implications.length).toBe(2)
    })

    it("accepts empty implications array", () => {
      const valid: IndicatorExplanation = {
        short: "",
        long: "",
        implications: [],
      }
      expect(valid.implications).toEqual([])
    })
  })
})

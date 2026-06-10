import { describe, expect, it } from "vitest"

import {
  annualMeanVariation,
  deflateToBaseYear,
  extractAnnualPoints,
  formatAnnualValue,
  parseAnnualPeriod,
  toAnnualMeans,
  type SeriesPoint,
} from "./annual-series"

function fullYear(year: number, value: number | ((month: number) => number)): SeriesPoint[] {
  return Array.from({ length: 12 }, (_, i) => ({
    period: `${year}-${String(i + 1).padStart(2, "0")}`,
    value: typeof value === "function" ? value(i + 1) : value,
  }))
}

describe("parseAnnualPeriod", () => {
  it("parses bare annual periods", () => {
    expect(parseAnnualPeriod("2024")).toEqual({ year: 2024, month: null })
  })

  it("parses EAES-style annual periods", () => {
    expect(parseAnnualPeriod("2023-A")).toEqual({ year: 2023, month: null })
  })

  it("parses monthly periods", () => {
    expect(parseAnnualPeriod("2024-05")).toEqual({ year: 2024, month: 5 })
  })

  it("rejects quarterly periods", () => {
    expect(parseAnnualPeriod("2024-T1")).toBeNull()
  })

  it("rejects malformed input", () => {
    expect(parseAnnualPeriod("")).toBeNull()
    expect(parseAnnualPeriod("abcd-01")).toBeNull()
    expect(parseAnnualPeriod("20245")).toBeNull()
  })

  it("rejects months outside 1-12", () => {
    expect(parseAnnualPeriod("2024-13")).toBeNull()
    expect(parseAnnualPeriod("2024-00")).toBeNull()
  })
})

describe("toAnnualMeans", () => {
  it("computes the mean of a complete year", () => {
    // months 1..12 → mean = 6.5
    const out = toAnnualMeans(fullYear(2023, (month) => month))
    expect(out).toEqual([{ year: 2023, value: 6.5 }])
  })

  it("drops the in-progress year", () => {
    const partial = fullYear(2024, 100).slice(0, 5)
    const out = toAnnualMeans([...fullYear(2023, 100), ...partial])
    expect(out.map((p) => p.year)).toEqual([2023])
  })

  it("drops years with a missing month", () => {
    const missingMarch = fullYear(2023, 100).filter((p) => p.period !== "2023-03")
    expect(toAnnualMeans(missingMarch)).toEqual([])
  })

  it("ignores annual rows mixed into the input", () => {
    const out = toAnnualMeans([
      ...fullYear(2023, 100),
      { period: "2022", value: 50 },
      { period: "2021-A", value: 40 },
    ])
    expect(out.map((p) => p.year)).toEqual([2023])
  })

  it("drops years where a month has a non-finite value", () => {
    const series = fullYear(2023, 100)
    series[4] = { period: "2023-05", value: Number.NaN }
    expect(toAnnualMeans(series)).toEqual([])
  })

  it("dedupes duplicate periods last-wins", () => {
    const out = toAnnualMeans([
      ...fullYear(2023, 100),
      { period: "2023-12", value: 112 },
    ])
    // 11 months at 100 + december at 112 → mean = 101
    expect(out).toEqual([{ year: 2023, value: 101 }])
  })

  it("returns ascending years from shuffled input", () => {
    const shuffled = [...fullYear(2024, 110), ...fullYear(2022, 90), ...fullYear(2023, 100)]
    const out = toAnnualMeans(shuffled)
    expect(out.map((p) => p.year)).toEqual([2022, 2023, 2024])
  })

  it("returns [] for empty input", () => {
    expect(toAnnualMeans([])).toEqual([])
  })
})

describe("annualMeanVariation", () => {
  it("computes the INE annual-means variation between consecutive years", () => {
    const out = annualMeanVariation([
      { year: 2022, value: 100 },
      { year: 2023, value: 103.5 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].year).toBe(2023)
    expect(out[0].value).toBeCloseTo(3.5, 9)
  })

  it("produces negative values in deflation years", () => {
    const out = annualMeanVariation([
      { year: 2013, value: 100 },
      { year: 2014, value: 99.8 },
    ])
    expect(out[0].value).toBeCloseTo(-0.2, 9)
  })

  it("never bridges a gap year", () => {
    const out = annualMeanVariation([
      { year: 2019, value: 100 },
      { year: 2021, value: 110 },
    ])
    expect(out).toEqual([])
  })

  it("skips when the previous mean is zero", () => {
    const out = annualMeanVariation([
      { year: 2022, value: 0 },
      { year: 2023, value: 100 },
    ])
    expect(out).toEqual([])
  })

  it("returns [] for single-year or empty input", () => {
    expect(annualMeanVariation([{ year: 2023, value: 100 }])).toEqual([])
    expect(annualMeanVariation([])).toEqual([])
  })
})

describe("deflateToBaseYear", () => {
  const index = [
    { year: 2020, value: 80 },
    { year: 2025, value: 100 },
  ]

  it("keeps the base-year value identical to nominal", () => {
    const out = deflateToBaseYear([{ year: 2025, value: 30000 }], index, 2025)
    expect(out).toEqual([{ year: 2025, value: 30000 }])
  })

  it("applies the index ratio for earlier years", () => {
    const out = deflateToBaseYear([{ year: 2020, value: 24000 }], index, 2025)
    // 24000 * 100/80 = 30000 in 2025 euros
    expect(out[0].value).toBeCloseTo(30000, 9)
  })

  it("drops nominal years missing from the index", () => {
    const out = deflateToBaseYear(
      [
        { year: 2019, value: 1000 },
        { year: 2020, value: 24000 },
      ],
      index,
      2025
    )
    expect(out.map((p) => p.year)).toEqual([2020])
  })

  it("returns [] when the base year is absent from the index", () => {
    expect(deflateToBaseYear([{ year: 2020, value: 24000 }], index, 2030)).toEqual([])
  })

  it("drops years with a non-positive index", () => {
    const out = deflateToBaseYear(
      [{ year: 2020, value: 24000 }],
      [
        { year: 2020, value: 0 },
        { year: 2025, value: 100 },
      ],
      2025
    )
    expect(out).toEqual([])
  })

  it("returns [] for empty nominal input", () => {
    expect(deflateToBaseYear([], index, 2025)).toEqual([])
  })
})

describe("extractAnnualPoints", () => {
  it("picks bare and EAES annual periods, ignoring monthly and quarterly", () => {
    const out = extractAnnualPoints([
      { period: "2021", value: 1 },
      { period: "2022-A", value: 2 },
      { period: "2022-05", value: 99 },
      { period: "2023-T1", value: 99 },
    ])
    expect(out).toEqual([
      { year: 2021, value: 1 },
      { year: 2022, value: 2 },
    ])
  })

  it("returns ascending years and dedupes last-wins", () => {
    const out = extractAnnualPoints([
      { period: "2023", value: 30 },
      { period: "2021", value: 10 },
      { period: "2023", value: 31 },
    ])
    expect(out).toEqual([
      { year: 2021, value: 10 },
      { year: 2023, value: 31 },
    ])
  })
})

describe("formatAnnualValue", () => {
  it("formats percentages with explicit sign", () => {
    expect(formatAnnualValue(2.8, "percent")).toBe("+2,8%")
    expect(formatAnnualValue(-0.5, "percent")).toBe("-0,5%")
  })

  it("formats millions EUR as billions", () => {
    expect(formatAnnualValue(1_698_224.6, "millionsEurBn")).toBe("1,70 B€")
  })

  it("formats annual euros without decimals", () => {
    expect(formatAnnualValue(26948.9, "eurosYear")).toBe("26.949 €")
  })
})

describe("monthly → means → variation pipeline", () => {
  it("locks the INE annual-means convention end-to-end", () => {
    const series = [
      ...fullYear(2022, 95),
      ...fullYear(2023, (month) => 100 + (month % 2)), // mean = 100.5
      ...fullYear(2024, 104),
      // in-progress year must not produce a bar
      { period: "2025-01", value: 105 },
      { period: "2025-02", value: 105.4 },
    ]
    const means = toAnnualMeans(series)
    expect(means.map((p) => p.year)).toEqual([2022, 2023, 2024])

    const variation = annualMeanVariation(means)
    expect(variation.map((p) => p.year)).toEqual([2023, 2024])
    expect(variation[0].value).toBeCloseTo((100.5 / 95 - 1) * 100, 9)
    expect(variation[1].value).toBeCloseTo((104 / 100.5 - 1) * 100, 9)
  })
})

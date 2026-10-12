import { existsSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"
import { CRITICAL_ETL_PIPELINES } from "./etl-pipelines"
import { COVERED_QUESTIONS, questionStatuses } from "./question-coverage"

it("links every covered question to an existing page and a real freshness monitor", () => {
  const keys = new Set<string>(CRITICAL_ETL_PIPELINES.map((spec) => spec.key))
  for (const question of COVERED_QUESTIONS) {
    expect(existsSync(join(__dirname, "..", "app", question.href, "page.tsx")), question.href).toBe(true)
    if (question.monitor) expect(keys.has(question.monitor), question.monitor).toBe(true)
    expect(question.excludes.length, question.question).toBeGreaterThan(10)
  }
})

it("never reports freshness it could not read", () => {
  const [first] = COVERED_QUESTIONS
  expect(questionStatuses([first], [])[0].status).toBe("unmonitored")
  expect(questionStatuses([first], [{ key: first.monitor!, status: "failed" }])[0].status).toBe("failed")
  expect(questionStatuses([{ ...first, monitor: null }], [{ key: first.monitor!, status: "fresh" }])[0].status).toBe("unmonitored")
})

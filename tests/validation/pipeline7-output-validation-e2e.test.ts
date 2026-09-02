import { expect, test } from "bun:test"
import { AutoroutingPipelineSolver, type SimpleRouteJson } from "lib"
import e2e3Fixture from "../../fixtures/legacy/assets/e2e3.json"

test("Pipeline7 topology validation accepts endpoints on connected multilayer pads", () => {
  const solver = new AutoroutingPipelineSolver(e2e3Fixture as SimpleRouteJson, {
    outputValidation: "topology-v1",
  })
  solver.solve()

  const output = solver.getOutputSimpleRouteJson()
  expect(solver.solved).toBe(true)
  expect(output.traces?.length).toBeGreaterThan(0)
})

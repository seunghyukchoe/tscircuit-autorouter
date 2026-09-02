import { expect, test } from "bun:test"
import type { SimpleRouteJson } from "lib/types"
import { validateAutorouterOutput } from "lib/validation/validate-autorouter-output"

test("rejects a via that violates a foreign connected obstacle clearance", () => {
  const inputSrj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    minViaDiameter: 0.6,
    bounds: { minX: -2, maxX: 2, minY: -1, maxY: 1 },
    obstacles: [
      {
        obstacleId: "victim-pad",
        type: "rect",
        layers: ["top"],
        center: { x: 0, y: 0.32 },
        width: 0.1,
        height: 0.1,
        connectedTo: ["victim-left"],
      },
    ],
    connections: [
      {
        name: "aggressor",
        pointsToConnect: [
          { x: -1, y: 0, layer: "top", pointId: "aggressor-left" },
          { x: 1, y: 0, layer: "bottom", pointId: "aggressor-right" },
        ],
      },
      {
        name: "victim",
        pointsToConnect: [
          { x: 0, y: 0.32, layer: "top", pointId: "victim-left" },
          { x: 1, y: 0.32, layer: "top", pointId: "victim-right" },
        ],
      },
    ],
  }
  const outputSrj: SimpleRouteJson = {
    ...inputSrj,
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "aggressor-trace",
        connection_name: "aggressor",
        connectsTo: ["aggressor-left", "aggressor-right"],
        route: [
          { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          {
            route_type: "via",
            x: 0,
            y: 0,
            from_layer: "top",
            to_layer: "bottom",
          },
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "bottom" },
          { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "bottom" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "victim-trace",
        connection_name: "victim",
        connectsTo: ["victim-left", "victim-right"],
        route: [
          { route_type: "wire", x: 0, y: 0.32, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0.32, width: 0.1, layer: "top" },
        ],
      },
    ],
  }

  expect(validateAutorouterOutput({ inputSrj, outputSrj })).toEqual({
    valid: true,
    diagnostics: [],
  })

  const result = validateAutorouterOutput({
    inputSrj,
    outputSrj,
    minimumObstacleClearance: 0.1,
  })
  expect(result.valid).toBe(false)
  expect(result.diagnostics).toHaveLength(1)
  expect(result.diagnostics[0]).toMatchObject({
    code: "VIA_OBSTACLE_CLEARANCE",
    connectionName: "aggressor",
    traceId: "aggressor-trace",
    layer: "top",
    segmentIndex: 2,
    coordinate: { x: 0, y: 0 },
    obstacleId: "victim-pad",
    minimumClearance: 0.1,
  })
  expect(result.diagnostics[0]!.actualClearance).toBeCloseTo(-0.03)

  const movedOutput = structuredClone(outputSrj)
  ;(movedOutput.traces![0]!.route[1] as { y: number }).y = -0.5
  ;(movedOutput.traces![0]!.route[2] as { y: number }).y = -0.5
  ;(movedOutput.traces![0]!.route[3] as { y: number }).y = -0.5
  expect(
    validateAutorouterOutput({
      inputSrj,
      outputSrj: movedOutput,
      minimumObstacleClearance: 0.1,
    }),
  ).toEqual({ valid: true, diagnostics: [] })

  expect(() =>
    validateAutorouterOutput({
      inputSrj,
      outputSrj,
      minimumObstacleClearance: Number.NaN,
    }),
  ).toThrow(RangeError)
})

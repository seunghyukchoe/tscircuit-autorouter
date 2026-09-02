import { expect, test } from "bun:test"
import {
  AutorouterOutputValidationError,
  AutoroutingPipelineSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTraces,
} from "lib"

const inputSrj: SimpleRouteJson = {
  layerCount: 2,
  minTraceWidth: 0.1,
  bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
  obstacles: [],
  connections: [
    {
      name: "horizontal",
      pointsToConnect: [
        { x: -4, y: 0, layer: "top", pointId: "h-left" },
        { x: 4, y: 0, layer: "top", pointId: "h-right" },
      ],
    },
    {
      name: "vertical",
      pointsToConnect: [
        { x: 0, y: -4, layer: "top", pointId: "v-bottom" },
        { x: 0, y: 4, layer: "top", pointId: "v-top" },
      ],
    },
  ],
}

const crossingTraces: SimplifiedPcbTraces = [
  {
    type: "pcb_trace",
    pcb_trace_id: "trace-horizontal",
    connection_name: "horizontal",
    connectsTo: ["h-left", "h-right"],
    route: [
      { route_type: "wire", x: -4, y: 0, width: 0.1, layer: "top" },
      { route_type: "wire", x: 4, y: 0, width: 0.1, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "trace-vertical",
    connection_name: "vertical",
    connectsTo: ["v-bottom", "v-top"],
    route: [
      { route_type: "wire", x: 0, y: -4, width: 0.1, layer: "top" },
      { route_type: "wire", x: 0, y: 4, width: 0.1, layer: "top" },
    ],
  },
]

test("Pipeline7 optionally validates topology at its SRJ output boundary", () => {
  const uncheckedSolver = new AutoroutingPipelineSolver(inputSrj)
  uncheckedSolver.getOutputSimplifiedPcbTraces = () => crossingTraces
  expect(uncheckedSolver.getOutputSimpleRouteJson().traces).toBe(crossingTraces)

  const validSolver = new AutoroutingPipelineSolver(inputSrj, {
    outputValidation: "topology-v1",
  })
  const validTraces = structuredClone(crossingTraces)
  validTraces[1]!.route = [
    { route_type: "wire", x: 0, y: -4, width: 0.1, layer: "top" },
    { route_type: "wire", x: 4.5, y: -4, width: 0.1, layer: "top" },
    { route_type: "wire", x: 4.5, y: 4, width: 0.1, layer: "top" },
    { route_type: "wire", x: 0, y: 4, width: 0.1, layer: "top" },
  ]
  validSolver.getOutputSimplifiedPcbTraces = () => validTraces
  expect(validSolver.getOutputSimpleRouteJson().traces).toBe(validTraces)

  const checkedSolver = new AutoroutingPipelineSolver(inputSrj, {
    outputValidation: "topology-v1",
  })
  checkedSolver.getOutputSimplifiedPcbTraces = () => crossingTraces

  expect(() => checkedSolver.getOutputSimpleRouteJson()).toThrow(
    AutorouterOutputValidationError,
  )
  try {
    checkedSolver.getOutputSimpleRouteJson()
    throw new Error("expected topology validation to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(AutorouterOutputValidationError)
    expect(
      (error as AutorouterOutputValidationError).result.diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["DIFFERENT_CONNECTION_SAME_LAYER_CROSSING"])
  }

  const unsupportedTraces = structuredClone(validTraces)
  unsupportedTraces[0]!.route[1] = {
    route_type: "through_obstacle",
    start: { x: -4, y: 0 },
    end: { x: 4, y: 0 },
    from_layer: "top",
    to_layer: "bottom",
    width: 0.1,
  }
  const unsupportedSolver = new AutoroutingPipelineSolver(inputSrj, {
    outputValidation: "topology-v1",
  })
  unsupportedSolver.getOutputSimplifiedPcbTraces = () => unsupportedTraces
  try {
    unsupportedSolver.getOutputSimpleRouteJson()
    throw new Error("expected unsupported geometry validation to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(AutorouterOutputValidationError)
    expect(
      (error as AutorouterOutputValidationError).result.diagnostics.some(
        (diagnostic) => diagnostic.code === "INVALID_SEGMENT",
      ),
    ).toBe(true)
  }
})

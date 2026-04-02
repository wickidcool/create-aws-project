import { startServer } from "../server.js";

describe("MCP Server", () => {
  it("exports startServer as an async function", () => {
    expect(typeof startServer).toBe("function");
  });
});

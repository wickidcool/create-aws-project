import { jest } from "@jest/globals";
import { MissingCredentialsError, requireEnvVars } from "../../tools/errors.js";

// Keep jest import used (suppress unused warning)
void jest;

describe("MissingCredentialsError", () => {
  it("has type === 'MISSING_CREDENTIALS'", () => {
    const error = new MissingCredentialsError(["AWS_ACCESS_KEY_ID"]);
    expect(error.type).toBe("MISSING_CREDENTIALS");
  });

  it("is an instance of Error", () => {
    const error = new MissingCredentialsError(["MY_VAR"]);
    expect(error).toBeInstanceOf(Error);
  });

  it("has name === 'MissingCredentialsError'", () => {
    const error = new MissingCredentialsError(["MY_VAR"]);
    expect(error.name).toBe("MissingCredentialsError");
  });

  it("includes all missing var names in the message", () => {
    const error = new MissingCredentialsError(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);
    expect(error.message).toContain("AWS_ACCESS_KEY_ID");
    expect(error.message).toContain("AWS_SECRET_ACCESS_KEY");
  });

  it("stores missingVars as an array on the error", () => {
    const vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
    const error = new MissingCredentialsError(vars);
    expect(error.missingVars).toEqual(vars);
  });

  it("includes a valid JSON .mcp.json snippet in the message", () => {
    const error = new MissingCredentialsError(["GITHUB_TOKEN"]);
    // Extract JSON from message — the snippet starts with '{'
    const jsonStartIndex = error.message.indexOf("{");
    expect(jsonStartIndex).toBeGreaterThan(-1);
    const jsonSnippet = error.message.slice(jsonStartIndex);
    let parsed: unknown;
    expect(() => {
      parsed = JSON.parse(jsonSnippet);
    }).not.toThrow();
    expect(parsed).toMatchObject({
      mcpServers: {
        "create-aws-project": {
          env: {
            GITHUB_TOKEN: "YOUR_VALUE_HERE",
          },
        },
      },
    });
  });

  it("includes all missing vars in the .mcp.json snippet", () => {
    const error = new MissingCredentialsError(["VAR_A", "VAR_B"]);
    const jsonStartIndex = error.message.indexOf("{");
    const parsed = JSON.parse(error.message.slice(jsonStartIndex)) as {
      mcpServers: { "create-aws-project": { env: Record<string, string> } };
    };
    const env = parsed.mcpServers["create-aws-project"].env;
    expect(env["VAR_A"]).toBe("YOUR_VALUE_HERE");
    expect(env["VAR_B"]).toBe("YOUR_VALUE_HERE");
  });
});

describe("requireEnvVars", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // Restore env to its original state
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("does not throw when all vars are present and non-empty", () => {
    process.env["TEST_CRED_A"] = "some-value";
    expect(() => requireEnvVars(["TEST_CRED_A"])).not.toThrow();
  });

  it("throws MissingCredentialsError when a var is absent", () => {
    delete process.env["TEST_MISSING_VAR"];
    expect(() => requireEnvVars(["TEST_MISSING_VAR"])).toThrow(MissingCredentialsError);
  });

  it("throws MissingCredentialsError when a var is empty string", () => {
    process.env["TEST_EMPTY_VAR"] = "";
    expect(() => requireEnvVars(["TEST_EMPTY_VAR"])).toThrow(MissingCredentialsError);
  });

  it("throws MissingCredentialsError when a var is whitespace only", () => {
    process.env["TEST_WHITESPACE_VAR"] = "   ";
    expect(() => requireEnvVars(["TEST_WHITESPACE_VAR"])).toThrow(MissingCredentialsError);
  });

  it("lists all missing vars in the thrown error", () => {
    delete process.env["TEST_MISSING_X"];
    delete process.env["TEST_MISSING_Y"];
    process.env["TEST_PRESENT"] = "value";

    let caught: unknown;
    try {
      requireEnvVars(["TEST_MISSING_X", "TEST_PRESENT", "TEST_MISSING_Y"]);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingCredentialsError);
    const error = caught as MissingCredentialsError;
    expect(error.missingVars).toEqual(["TEST_MISSING_X", "TEST_MISSING_Y"]);
  });

  it("does not throw when given an empty array", () => {
    expect(() => requireEnvVars([])).not.toThrow();
  });
});

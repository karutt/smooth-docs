import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const contractSchemaUrl = new URL(
  "../../specs/001-interactive-flow-viewer/contracts/docs-flow.schema.json",
  import.meta.url,
);
const runtimeSchemaUrl = new URL("../../src/docs-flow/schema.json", import.meta.url);

test("the runtime schema is byte-for-byte identical to the published contract", async () => {
  const [contractSchema, runtimeSchema] = await Promise.all([
    readFile(contractSchemaUrl),
    readFile(runtimeSchemaUrl),
  ]);

  assert.deepEqual(runtimeSchema, contractSchema);
});

test("the runtime Draft 2020-12 schema compiles with Ajv strict mode", async () => {
  const schema = JSON.parse(await readFile(runtimeSchemaUrl, "utf8"));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  });

  assert.doesNotThrow(() => ajv.compile(schema));
});

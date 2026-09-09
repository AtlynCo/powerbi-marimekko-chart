import assert from "node:assert/strict";
import { createRequire } from "node:module";
import JSZip from "jszip";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("powerbi-visuals-webpack-plugin"));
assert.equal(sdkRequire.resolve("jszip"), require.resolve("jszip"), "Review ZIP defaults after SDK dependency changes");

// Configure the exported JSZip defaults before the unmodified SDK creates its archive.
// Canonical ZIP timestamps are not build timestamps; the release manifest records the actual build evidence.
JSZip.defaults.date = new Date("1980-01-01T00:00:00.000Z");

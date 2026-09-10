import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

assert.equal(process.argv.length, 2, "Usage: node scripts/prepare-native-sample.mjs");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", ["-c", "core.longpaths=true", ...args],
    { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
assert.equal(git("status", "--porcelain").toString("utf8").trim(), "", "Commit reviewed source before preparing a native handoff");
const commit = git("rev-parse", "HEAD").toString("utf8").trim();
const destination = join(root, "dist", `native-sample-${commit.slice(0, 12)}`);
assert(!existsSync(destination), `Do not overwrite an existing handoff: ${destination}`);

// Capture archive stdout as bytes; a shell text pipeline can silently rewrite SDK manifest newlines.
const source = await JSZip.loadAsync(git("archive", "--format=zip", commit, "samples"), { checkCRC32: true });
const files = new Map();
for (const entry of Object.values(source.files)) {
    if (entry.dir) continue;
    assert(entry.name.startsWith("samples/") && !entry.name.includes("\\") && !entry.name.includes(":") &&
        entry.name.split("/").every(part => part !== "" && part !== "." && part !== ".."), "Unsafe sample archive path");
    assert(!entry.unsafeOriginalName || entry.unsafeOriginalName === entry.name, "Unsafe original archive path");
    assert((Number(entry.unixPermissions) & 0o170000) !== 0o120000, "Sample symlinks are unsupported");
    files.set(entry.name.slice("samples/".length), await entry.async("nodebuffer"));
}
const assembly = JSON.parse(files.get("assembly-manifest.json").toString("utf8"));
for (const entry of assembly.generatedFiles) {
    const bytes = files.get(entry.path);
    assert(bytes && bytes.length === entry.bytes && hash(bytes) === entry.sha256, `Stale committed sample bytes: ${entry.path}`);
}
const packageFile = `${assembly.visual.guid}.${assembly.visual.version}.pbiviz`;
const packageBytes = readFileSync(join(root, "dist", packageFile));
assert.equal(packageBytes.length, assembly.package.bytes);
assert.equal(hash(packageBytes), assembly.package.sha256);
const sdk = await JSZip.loadAsync(packageBytes, { checkCRC32: true });
const embeddedRoot = `AtlynMarimekko.Report/CustomVisuals/${assembly.visual.guid}/`;
const sdkEntries = [];
for (const entry of Object.values(sdk.files)) {
    if (entry.dir) continue;
    const expected = await entry.async("nodebuffer");
    const actual = files.get(embeddedRoot + entry.name);
    assert(actual?.equals(expected), `Embedded SDK entry differs as raw bytes: ${entry.name}`);
    sdkEntries.push({ path: entry.name, bytes: expected.length, sha256: hash(expected) });
}
assert.equal([...files.keys()].filter(path => path.startsWith(embeddedRoot)).length, sdkEntries.length,
    "Unexpected extra embedded SDK files");
assert(sdkEntries.length > 0);

mkdirSync(destination);
const inventory = [];
for (const [path, bytes] of files) {
    const output = join(destination, "sample", ...path.split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes, { flag: "wx" });
    assert(readFileSync(output).equals(bytes), `Written sample bytes differ: ${path}`);
    inventory.push({ path: `sample/${path}`, bytes: bytes.length, sha256: hash(bytes) });
}
writeFileSync(join(destination, packageFile), packageBytes, { flag: "wx" });
assert(readFileSync(join(destination, packageFile)).equals(packageBytes));
inventory.push({ path: packageFile, bytes: packageBytes.length, sha256: hash(packageBytes) });
const manifest = {
    kind: "provisional-native-sample",
    sourceCommit: commit,
    package: { file: packageFile, bytes: packageBytes.length, sha256: hash(packageBytes), rebuilt: false },
    sdkEntries,
    nativeAcceptance: "parent-corrected-sample-retry-pending",
    certificationStatus: "request-review-pending",
    sourceExport: "git archive captured as raw Buffer; every embedded SDK entry compared without normalization",
    files: inventory
};
writeFileSync(join(destination, "provisional-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ destination, sourceCommit: commit, package: manifest.package, sdkEntries }, null, 2));

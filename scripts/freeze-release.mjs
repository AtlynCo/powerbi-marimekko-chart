import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync, lstatSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import os from "node:os";

assert.equal(process.argv.length, 2, "No arguments supported; freeze uses the committed worktree and final evidence");
const root = process.cwd();
const git = (...args) => execFileSync("git", ["-c", "core.longpaths=true", ...args], { encoding: "utf8", cwd: root }).trim();
assert.equal(git("status", "--porcelain"), "", "Commit the reviewed source and assets before freezing");
const commit = git("rev-parse", "HEAD");
const config = JSON.parse(readFileSync("pbiviz.json", "utf8"));
const audit = JSON.parse(readFileSync(join("dist", "package-audit.json"), "utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const filename = `${config.visual.guid}.${config.visual.version}.pbiviz`;
const packageBytes = readFileSync(join("dist", filename));
assert.equal(sha256(packageBytes), audit.sha256, "Package differs from its audit");
assert.equal(packageBytes.length, audit.bytes);
assert.equal(audit.guid, config.visual.guid);
assert.equal(audit.version, config.visual.version);
const assembly = JSON.parse(readFileSync(join("samples", "assembly-manifest.json"), "utf8"));
assert.equal(assembly.package.sha256, audit.sha256, "Sample has a stale package");
assert.equal(assembly.package.bytes, audit.bytes);
const finalEvidence = join(".tmp", "quality-evidence", "final");
assert.ok(existsSync(finalEvidence), "Final local evidence is missing");
assert.ok(existsSync(join("assets", "submission")), "Final submission screenshots are missing");
const browserStatus = JSON.parse(readFileSync(join(finalEvidence, "browser-release-status.json"), "utf8"));
assert.equal(browserStatus.releaseReady, true, "Final browser evidence is blocked");
assert.equal(browserStatus.packageSha256, audit.sha256);
assert.equal(browserStatus.functionalStats.unexpected, 0);
function filesUnder(folder) {
    return readdirSync(folder).sort().flatMap(name => {
        const path = join(folder, name);
        const stat = lstatSync(path);
        assert.ok(!stat.isSymbolicLink(), `Do not freeze symlinked evidence: ${path}`);
        return stat.isDirectory() ? filesUnder(path) : [path];
    });
}
let matchingEvidence = 0;
for (const path of filesUnder(finalEvidence).filter(path => path.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (data.package?.sha256) {
        assert.equal(data.package.sha256, audit.sha256, `Stale final evidence: ${path}`);
        matchingEvidence++;
    }
    if (data.stats) assert.equal(data.stats.unexpected, 0, `Failed browser cases: ${path}`);
}
assert.ok(matchingEvidence >= 2, "Expected final package-linked viewport and performance evidence");
const screenshotCounts = new Map();
for (const path of filesUnder(join("assets", "submission")).filter(path => path.endsWith(".png"))) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, readFileSync(join(finalEvidence, basename(path))), "Submission image differs from its final capture");
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.length <= 1024 * 1024, `Oversized screenshot: ${path}`);
    const size = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
    assert.ok(["1366x768", "1280x720"].includes(size), `Unexpected submission screenshot dimensions: ${path}`);
    screenshotCounts.set(size, (screenshotCounts.get(size) ?? 0) + 1);
}
for (const size of ["1366x768", "1280x720"]) {
    const count = screenshotCounts.get(size) ?? 0;
    assert.ok(count >= 1 && count <= 5, `Expected 1-5 actual ${size} screenshots`);
}
const userAgent = process.env.npm_config_user_agent;
assert.ok(userAgent?.startsWith("npm/"), "Run through npm run release:freeze to record npm version");

const output = resolve("dist", `release-${config.visual.version}-${commit.slice(0, 12)}-${audit.sha256.slice(0, 12)}`);
assert.ok(!existsSync(output), "Immutable candidate already exists; refusing to overwrite");
mkdirSync(output);
function copy(source, destination) {
    assert.ok(lstatSync(source).isFile(), `Expected a regular artifact: ${source}`);
    mkdirSync(join(output, destination, ".."), { recursive: true });
    copyFileSync(source, join(output, destination));
}
function copyTree(source, destination) {
    for (const path of filesUnder(source)) copy(path, join(destination, relative(source, path)));
}
copy(join("dist", filename), filename);
copy(join("dist", `${filename}.sha256`), `${filename}.sha256`);
copy(join("dist", "package-audit.json"), "package-audit.json");
copy(join("dist", "certification-audit.json"), "certification-audit.json");
copyTree(finalEvidence, "evidence");
if (existsSync(join(".tmp", "quality-evidence", "baseline"))) {
    copyTree(join(".tmp", "quality-evidence", "baseline"), join("evidence", "baseline"));
}
if (existsSync(join(".tmp", "quality-evidence", "before-pager-fix"))) {
    copyTree(join(".tmp", "quality-evidence", "before-pager-fix"), join("evidence", "regression-before"));
}
copyTree(join("assets", "submission"), join("assets", "submission"));
copy(join("assets", "icon.png"), join("assets", "icon.png"));
copy(join("assets", "icon-300.png"), join("assets", "icon-300.png"));
for (const path of git("ls-files", "samples").split("\n")) {
    copy(join(...path.split("/")), join(...path.split("/")));
}
for (const name of ["marketplace-dossier.md", "release-checklist.md", "quality-review.md", "authoring.md", "data-contract.md"]) {
    copy(join("docs", name), join("docs", name));
}
execFileSync("git", ["-c", "core.longpaths=true", "archive", "--format=zip",
    `--output=${join(output, `source-${commit}.zip`)}`, commit], { cwd: root });
const inventory = [];
for (const path of filesUnder(output)) {
    const bytes = readFileSync(path);
    inventory.push({ path: relative(output, path), bytes: bytes.length, sha256: sha256(bytes) });
}
const toolNames = ["powerbi-visuals-tools", "powerbi-visuals-api", "typescript", "eslint", "@playwright/test", "jszip"];
const tools = Object.fromEntries(toolNames.map(name => [name,
    JSON.parse(readFileSync(join("node_modules", ...name.split("/"), "package.json"), "utf8")).version]));
const manifest = {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    source: { repository: "AtlynCo/powerbi-marimekko-chart", private: true, commit, tree: git("rev-parse", "HEAD^{tree}"),
        implementationBranch: git("branch", "--show-current"), certificationBranch: "certification",
        certificationBranchStatus: "Coordinator must confirm matching commit and freeze before submission" },
    package: { filename, guid: audit.guid, version: audit.version, apiVersion: audit.apiVersion,
        bytes: audit.bytes, sha256: audit.sha256, contentHashes: audit.contentHashes,
        zipTimestampPolicy: "Canonical 1980-01-01 UTC defaults configured before unchanged official SDK packaging" },
    tools: { node: process.version, npmUserAgent: userAgent, ...tools },
    environment: { platform: os.platform(), release: os.release(), architecture: os.arch() },
    evidenceScope: "Exact-package local Chromium with Power BI host mocks; raw timings include shared-machine contention. Not native acceptance.",
    nativeHostValidated: false, microsoftCertified: false, marketplaceSubmitted: false,
    outstandingGates: ["Coordinator native Desktop/PBIX/Service/export and assistive-technology acceptance",
        "Owner-approved publisher/distribution, EULA, privacy, pricing and support readiness",
        "Screenshot upload validation and reviewer source access", "Parent-only Partner Center submission and Microsoft review"],
    files: inventory
};
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(join(output, "release-manifest.json"), serialized);
writeFileSync(join(output, "release-manifest.json.sha256"), `${sha256(serialized)}  release-manifest.json\n`);
for (const file of inventory) assert.equal(sha256(readFileSync(join(output, file.path))), file.sha256);
console.log(`Frozen ${inventory.length} files at ${output}\nSource ${commit}\nPackage SHA256 ${audit.sha256}`);

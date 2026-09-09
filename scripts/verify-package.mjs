import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import powerbiApi from "powerbi-visuals-api";

const GUID = "AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472";
const VERSION = "1.0.1.0";
const filename = `${GUID}.${VERSION}.pbiviz`;
const files = readdirSync("dist").filter(name => name === filename);
assert.equal(files.length, 1, "Expected the exact current release package");
const path = join("dist", filename);
const bytes = readFileSync(path);
const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
const readJson = async name => {
    const file = zip.file(name);
    assert.ok(file, `Missing packaged ${name}`);
    return JSON.parse(await file.async("string"));
};
const manifest = await readJson("package.json");
assert.equal(manifest.resources.length, 1);
const resource = manifest.resources[0].file;
assert.equal(resource, `resources/${GUID}.pbiviz.json`);
const payload = await readJson(resource);
assert.equal(manifest.version, VERSION);
assert.deepEqual(manifest.visual, payload.visual);
assert.deepEqual(manifest.author, payload.author);
assert.equal(payload.visual.guid, GUID);
assert.equal(payload.visual.version, VERSION);
assert.equal(payload.apiVersion, "5.11.0");
assert.equal(payload.apiVersion, powerbiApi.version);
assert.equal(payload.apiVersion, JSON.parse(readFileSync("pbiviz.json", "utf8")).apiVersion);
assert.equal(payload.visual.visualClassName, "Visual");
assert.equal(payload.author.email, "atlyn.help@gmail.com");
assert.equal(payload.visual.supportUrl, "https://www.atlynco.com/docs/faq");
assert.deepEqual(payload.visual, JSON.parse(readFileSync("pbiviz.json", "utf8")).visual);
assert.deepEqual(payload.capabilities, JSON.parse(readFileSync("capabilities.json", "utf8")));
assert.deepEqual(payload.capabilities.privileges, []);
assert.deepEqual(payload.externalJS, []);
assert.equal(payload.capabilities.supportsHighlight, true);
assert.equal(payload.capabilities.supportsKeyboardFocus, true);
assert.ok(payload.content.js.length > 20000, "Missing implementation code");
assert.ok(payload.content.css.includes(".atlyn-marimekko"), "Missing scoped visual styles");
assert.ok(payload.content.js.includes(GUID), "Missing registered native plugin");
assert.ok(payload.content.js.includes("Software Freedom Conservancy"), "Missing embedded third-party attribution");
assert.ok(payload.content.js.includes("Permission is hereby granted"), "Missing embedded MIT terms");
assert.ok(payload.stringResources["fr-FR"].Role_Component);
assert.ok(payload.stringResources["en-US"].Role_Component);
for (const [file, entry] of Object.entries(zip.files)) {
    assert.ok(!/(\.pfx|\.key|Pass\.txt|node_modules|\.map)$/i.test(file), `Unexpected file ${file}`);
    assert.equal(entry.date.toISOString(), "1980-01-01T00:00:00.000Z", "Noncanonical SDK archive timestamp");
}
assert.ok(!/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(payload.content.js), "Private key in package");
assert.ok(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(payload.content.js), "Dynamic code in payload");
const icon = Buffer.from(payload.content.iconBase64.replace(/^data:image\/png;base64,/, ""), "base64");
assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(icon.readUInt32BE(16), 20);
assert.equal(icon.readUInt32BE(20), 20);
assert.deepEqual(icon, readFileSync(join("assets", "icon.png")));
const storeIcon = readFileSync(join("assets", "icon-300.png"));
assert.equal(storeIcon.readUInt32BE(16), 300);
assert.equal(storeIcon.readUInt32BE(20), 300);
const hash = data => createHash("sha256").update(data).digest("hex");
const sha256 = createHash("sha256").update(bytes).digest("hex");
writeFileSync(`${path}.sha256`, `${sha256}  ${files[0]}\n`);
writeFileSync("dist/package-audit.json", JSON.stringify({
    guid: GUID, version: VERSION, apiVersion: payload.apiVersion, artifact: resolve(path),
    sha256, bytes: bytes.length, entries: Object.keys(zip.files), privileges: payload.capabilities.privileges,
    javascriptBytes: Buffer.byteLength(payload.content.js), cssBytes: Buffer.byteLength(payload.content.css),
    contentHashes: {
        manifest: hash(await zip.file("package.json").async("nodebuffer")),
        payload: hash(await zip.file(resource).async("nodebuffer")),
        javascript: hash(payload.content.js), css: hash(payload.content.css), icon20: hash(icon), icon300: hash(storeIcon)
    },
    nativeHostValidated: false, microsoftCertified: false
}, null, 2) + "\n");
console.log(`Verified ${files[0]} (${bytes.length} bytes)\nSHA256 ${sha256}`);

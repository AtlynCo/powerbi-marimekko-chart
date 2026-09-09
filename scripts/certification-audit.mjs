import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

function run(script, args = []) {
    const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${script} failed`);
}
run("scripts/build.mjs", ["--certification-audit"]);
run("scripts/verify-package.mjs");
run("scripts/notices.mjs", ["--check"]);
const files = readdirSync("src").filter(name => name.endsWith(".ts"));
const bannedCalls = new Set(["eval", "Function", "fetch", "XMLHttpRequest", "WebSocket", "Worker", "importScripts", "sendBeacon"]);
for (const name of files) {
    const content = readFileSync(join("src", name), "utf8");
    const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true);
    function visit(node) {
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
            const target = node.expression;
            const callee = ts.isIdentifier(target) ? target.text : ts.isPropertyAccessExpression(target) ? target.name.text : "";
            assert.ok(!bannedCalls.has(callee), `${name}: prohibited dynamic code/network call ${callee}`);
        }
        if (ts.isPropertyAccessExpression(node)) {
            assert.ok(!["innerHTML", "outerHTML", "telemetry", "localStorage", "sessionStorage"].includes(node.name.text),
                `${name}: review prohibited DOM, telemetry or storage access ${node.name.text}`);
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
const report = {
    sdkCertificationAudit: "passed",
    sourcePolicyScan: "passed",
    packageValidation: "passed",
    dependencyNotices: "passed",
    scope: "Local static/tooling checks only. Not Microsoft certification, a security guarantee, or native Desktop/service/export validation.",
    manualPublicationNeeds: ["Native host and export matrix", "Accessibility assistive-technology review",
        "Support ownership/responsiveness", "Owner-approved legal/privacy terms", "Partner Center/AppSource submission and Microsoft review"]
};
writeFileSync("dist/certification-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(report.scope);

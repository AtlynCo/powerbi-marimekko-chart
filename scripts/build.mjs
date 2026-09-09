import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const home = resolve(".tmp", "tool-home");
const certFolder = join(home, "pbiviz-certs");
mkdirSync(certFolder, { recursive: true });
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !["home", "userprofile", "npm_config_cache"].includes(key.toLowerCase())));
const env = { ...inherited, HOME: home, USERPROFILE: home, npm_config_cache: resolve(".tmp", "npm-cache") };
function run(command, args, extraEnv = {}) {
    const result = spawnSync(command, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--certification-audit")) throw new Error("Unsupported build argument");
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
if (manifest.private !== true) throw new Error("This release must remain private");
try {
    // The SDK resolves a certificate even for offline packaging. Export it in memory, never to a user store.
    if (process.platform === "win32") {
        const password = randomBytes(24).toString("hex");
        const file = join(certFolder, "PowerBICustomVisualTest_public.pfx");
        run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
        $ErrorActionPreference = 'Stop'
        $rsa = [System.Security.Cryptography.RSA]::Create(2048)
        $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
            'CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256,
            [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(30))
        [IO.File]::WriteAllBytes($env:ATLYN_CERTIFICATE_FILE,
            $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $env:ATLYN_CERTIFICATE_PASSWORD))
        $certificate.Dispose()
        $rsa.Dispose()
        `], { ATLYN_CERTIFICATE_FILE: file, ATLYN_CERTIFICATE_PASSWORD: password });
        writeFileSync(join(certFolder, "PowerBICustomVisualTestPass.txt"), password);
    } else {
        run("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-x509", "-days", "30", "-subj", "/CN=localhost",
            "-keyout", join(certFolder, "PowerBICustomVisualTest_private.key"),
            "-out", join(certFolder, "PowerBICustomVisualTest_public.crt")]);
    }
    run(process.execPath, ["--import", pathToFileURL(join(root, "scripts", "zip-defaults.mjs")).href,
        join("node_modules", "powerbi-visuals-tools", "bin", "pbiviz.js"),
        "package", "--no-stats", "--all-locales", ...args]);
} finally {
    for (const file of ["PowerBICustomVisualTest_public.pfx", "PowerBICustomVisualTestPass.txt",
        "PowerBICustomVisualTest_private.key", "PowerBICustomVisualTest_public.crt"]) {
        rmSync(join(certFolder, file), { force: true });
    }
}

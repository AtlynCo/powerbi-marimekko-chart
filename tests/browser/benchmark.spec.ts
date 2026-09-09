import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import os from "node:os";
import { mount, readPackagedVisual } from "./host";
import { FIXTURE_SEED, seededFixture } from "./oracles";

const WARMUPS = 5;
const SAMPLES = 30;
function environment() {
    return {
        timestamp: new Date().toISOString(), node: process.version, chromiumDriver: "@playwright/test 1.63.0",
        os: { platform: os.platform(), release: os.release(), version: os.version(), architecture: os.arch() },
        cpuModels: [...new Set(os.cpus().map(cpu => cpu.model))], logicalCores: os.cpus().length,
        cpuCounters: os.cpus().map(cpu => cpu.times),
        ramBytes: os.totalmem(), freeRamBytes: os.freemem(),
        nodeProcessResourceUsage: process.resourceUsage()
    };
}
function summaries(samples: Record<string, number>[]) {
    return Object.fromEntries(Object.keys(samples[0] ?? {}).map(key => {
        const values = samples.map(sample => sample[key]!).sort((a, b) => a - b);
        return [key, { p50: values[Math.ceil(values.length * .5) - 1],
            p95: values[Math.ceil(values.length * .95) - 1], max: values.at(-1), min: values[0] }];
    }));
}

// Run independently with QUALITY_BENCHMARK=1 and QUALITY_LABEL; never a timing pass/fail gate.
test("local packaged render and selection benchmark with raw samples", async ({ page, browser }) => {
    test.setTimeout(600_000);
    const label = process.env.QUALITY_LABEL ?? "candidate";
    if (!/^(baseline|candidate|final)$/.test(label)) throw new Error("Unknown benchmark label");
    if (label === "final" && process.env.QUALITY_UI_FROZEN !== "1") throw new Error("Final benchmarks require an explicitly frozen UI");
    const directory = resolve(".tmp", "quality-evidence", label);
    await mkdir(directory, { recursive: true });
    const packaged = await readPackagedVisual();
    const archivedPackage = `${packaged.info.guid}.${packaged.info.version}.${packaged.info.sha256.slice(0, 12)}.pbiviz`;
    await writeFile(resolve(directory, archivedPackage), packaged.archive);
    const startEnvironment = environment();
    const results = [];
    const configurations = [{ segments: 12, components: 5 }, { segments: 200, components: 20 }, { segments: 100, components: 40 }];
    const viewport = { width: 1280, height: 620 };
    await page.setViewportSize(viewport);
    for (const configuration of configurations) {
        const fixture = seededFixture(configuration.segments, configuration.components);
        await mount(page, fixture);
        await page.evaluate(({ fixture, viewport }) => {
            window.harness.prepare(fixture, viewport.width, viewport.height);
            window.harness.updatePrepared();
        }, { fixture, viewport });
        await expect(page.locator(".chart .cell")).toHaveCount(configuration.segments * configuration.components);
        const before = environment();
        const measurements = await page.evaluate(async ({ warmups, samples }) => {
            const harness = window.harness;
            const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const render: Record<string, number>[] = [];
            const selection: Record<string, number>[] = [];
            const rect = () => {
                const node = document.querySelector<SVGRectElement>("#visual .chart .cell");
                if (!node) throw new Error("Benchmark requires actual packaged cells");
                return node;
            };
            for (let i = -warmups; i < samples; i++) {
                harness.resetHistory();
                await nextFrame();
                const start = performance.now();
                harness.updatePrepared();
                const synchronous = performance.now();
                rect().getBoundingClientRect();
                const layout = performance.now();
                await nextFrame();
                const firstFrame = performance.now();
                await nextFrame();
                const secondFrame = performance.now();
                if (harness.log.failures.length) throw new Error(harness.log.failures.join("; "));
                if (i >= 0) render.push({ syncUpdateMs: synchronous - start, updateAndForcedLayoutMs: layout - start,
                    updateToNextAnimationFrameMs: firstFrame - start, updateToSecondAnimationFrameMs: secondFrame - start });
            }
            for (let i = -warmups; i < samples; i++) {
                harness.external([]);
                harness.resetHistory();
                const target = rect();
                target.getBoundingClientRect();
                await nextFrame();
                await nextFrame();
                const start = performance.now();
                target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                const handler = performance.now();
                await Promise.resolve();
                await Promise.resolve();
                const settled = performance.now();
                target.getBoundingClientRect();
                const layout = performance.now();
                await nextFrame();
                const firstFrame = performance.now();
                await nextFrame();
                const secondFrame = performance.now();
                if (!target.classList.contains("selected")) throw new Error("Selection did not paint");
                if (i >= 0) selection.push({ syncDispatchHandlerMs: handler - start,
                    dispatchAndPromiseMicrotasksMs: settled - start, dispatchAndForcedLayoutMs: layout - start,
                    selectionToNextAnimationFrameMs: firstFrame - start, selectionToSecondAnimationFrameMs: secondFrame - start });
            }
            const result = { render, selection, boundedFinalHistory: {
                issuedIds: harness.ids.length, events: harness.log.events.length, selections: harness.log.select.length
            } };
            harness.visual.destroy?.();
            harness.resetHistory();
            return result;
        }, { warmups: WARMUPS, samples: SAMPLES });
        results.push({ ...configuration, cells: configuration.segments * configuration.components,
            fixture, beforeEnvironment: before, afterEnvironment: environment(),
            render: { summaryMs: summaries(measurements.render), rawSamplesMs: measurements.render },
            selection: { summaryMs: summaries(measurements.selection), rawSamplesMs: measurements.selection },
            boundedFinalHistory: measurements.boundedFinalHistory });
        await writeFile(resolve(directory, `${label}-benchmark.json`), JSON.stringify({
            label, package: packaged.info, archivedPackage, chromium: browser.version(), startEnvironment, endEnvironment: environment(),
            setup: { fixtureSeed: FIXTURE_SEED, generator: "LCG 1664525/1013904223, unsigned32, values 1+(state%1000)",
                warmupsPerScenarioAndOperation: WARMUPS, recordedSamplesPerScenarioAndOperation: SAMPLES,
                workers: 1, browserContexts: 1, viewport, deviceScaleFactor: 1, headless: true,
                trace: false, screenshots: false, tableOpen: false, labelsEnabled: true, nativeHost: false },
            definitions: {
                syncUpdateMs: "performance.now around IVisual.update using a prepared DataView; fixture construction is excluded.",
                updateAndForcedLayoutMs: "Update start through getBoundingClientRect on the first actual cell; forces outstanding layout.",
                syncDispatchHandlerMs: "Actual DOM MouseEvent dispatch and synchronous selection handler; host Promise continuation is excluded.",
                dispatchAndPromiseMicrotasksMs: "Dispatch start through two Promise microtasks, including the visual's host-selection continuation.",
                animationFrames: "Latency from operation start to first/second requestAnimationFrame callbacks. Two frames are only a frame-ready proxy, not measured compositor presentation or native Power BI latency.",
                percentile: "Nearest-rank percentile across exactly 30 recorded samples; warmups excluded."
            },
            limitations: [
                "Shared Windows machine; other users/processes may contend. No process termination, priority changes, CPU isolation, throttling or native-app manipulation.",
                "Logical CPU counters and free RAM before/after each scenario document coarse system activity, not attribution or contention-free execution.",
                "Synthetic SDK host creates identities and resolves selection promises locally; its CPU/Promise overhead is included and differs from Desktop/Service.",
                "Recorded log/history arrays and issued-identity references reset outside each timed iteration; stable identity map is bounded by fixture identities.",
                "No forced garbage collection; browser scheduling and natural GC contribute noise. No timing pass/fail thresholds or speed claims.",
                "Same prepared cumulative DataView is reused; this measures warm render, not package startup, network, model-query or host aggregation cost."
            ], results
        }, null, 2));
    }
});

import type powerbi from "powerbi-visuals-api";
import { test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";

export const GUID = "AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472";
type Identity = powerbi.visuals.ISelectionId;
type Parts = Record<string, string>;
type NativePromiseManager = Omit<powerbi.extensibility.ISelectionManager, "select" | "clear" | "showContextMenu" | "toggleExpandCollapse"> & {
    select(ids: powerbi.extensibility.ISelectionId | powerbi.extensibility.ISelectionId[], multiple?: boolean): Promise<Identity[]>;
    clear(): Promise<object>;
    showContextMenu(id: powerbi.extensibility.ISelectionId, position: powerbi.extensibility.IPoint): Promise<object>;
    toggleExpandCollapse(): Promise<object>;
};
export interface Fixture {
    segments?: (string | number | null)[];
    components?: (string | number | null)[];
    values?: (number | string | null)[][];
    highlights?: (number | null)[][];
    format?: string;
    dynamicFormat?: string;
    categoryFormat?: string;
    componentFormat?: string;
    additive?: boolean;
    partial?: boolean;
    showTable?: boolean;
    showLabels?: boolean;
    labelContent?: "raw" | "segmentShare" | "overallShare";
    direction?: "auto" | "ltr" | "rtl";
    fontSize?: number;
    minLabelWidth?: number;
    noCategoryIdentity?: boolean;
    noSeriesIdentity?: boolean;
    duplicateCategoryIdentity?: boolean;
    invalidBinding?: boolean;
}
export interface HostOptions {
    locale?: string;
    highContrast?: boolean;
    allowInteractions?: boolean;
    fetchResult?: boolean;
    rejectInteractions?: boolean;
    tooltipEnabled?: boolean;
    instanceId?: string;
}
export interface HostLog {
    select: { key: string; multiple: boolean }[];
    clear: number;
    context: { key: string; x: number; y: number }[];
    fetch: (boolean | undefined)[];
    tooltip: { kind: string; keys?: string[]; dataItems?: powerbi.extensibility.VisualTooltipDataItem[];
        coordinates?: number[]; immediately?: boolean; isTouchEvent?: boolean }[];
    events: string[];
    failures: string[];
    localization: string[];
    persisted: powerbi.VisualObjectInstancesToPersist[];
}
export interface BrowserHarness {
    visual: powerbi.extensibility.visual.IVisual;
    log: HostLog;
    update(fixture?: Fixture, width?: number, height?: number, append?: boolean): void;
    resize(width: number, height: number): void;
    clearData(): void;
    external(parts: Parts[]): void;
    setHostOptions(options: HostOptions): void;
    resetHistory(): void;
    prepare(fixture: Fixture, width: number, height: number): void;
    updatePrepared(): void;
    ids: Identity[];
}
export interface PackageInfo { path: string; sha256: string; bytes: number; guid: string; version: string }
async function loadPackagedVisual() {
    const manifest = JSON.parse(await readFile(resolve("pbiviz.json"), "utf8")) as { visual: { guid: string; version: string } };
    const path = resolve(process.env.PBIVIZ_PACKAGE ?? resolve("dist", `${manifest.visual.guid}.${manifest.visual.version}.pbiviz`));
    const bytes = await readFile(path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (process.env.PBIVIZ_EXPECTED_SHA256 && sha256 !== process.env.PBIVIZ_EXPECTED_SHA256.toLowerCase()) {
        throw new Error(`Package hash mismatch: expected ${process.env.PBIVIZ_EXPECTED_SHA256}, read ${sha256}`);
    }
    const zip = await JSZip.loadAsync(bytes);
    const resource = zip.file(`resources/${manifest.visual.guid}.pbiviz.json`);
    if (!resource) throw new Error("Packaged visual resource is missing");
    const packaged = JSON.parse(await resource.async("string")) as {
        visual: { guid: string; version: string }; content: { js: string; css: string }
    };
    if (!packaged.content.js || !packaged.content.css) throw new Error("PBIVIZ must include JavaScript and CSS");
    if (packaged.visual.guid !== GUID) throw new Error("The frozen visual GUID changed");
    if (!process.env.PBIVIZ_PACKAGE && packaged.visual.version !== manifest.visual.version) {
        throw new Error("Packaged version differs from pbiviz.json; rebuild before testing");
    }
    return { ...packaged.content, archive: bytes, info: { path, sha256,
        bytes: bytes.length, guid: packaged.visual.guid, version: packaged.visual.version } satisfies PackageInfo };
}
let packagedSnapshot: ReturnType<typeof loadPackagedVisual> | undefined;
export function readPackagedVisual() {
    // Pin one immutable archive per worker so a concurrent rebuild cannot mix package revisions in an evidence run.
    return packagedSnapshot ??= loadPackagedVisual();
}
declare global {
    interface Window {
        powerbi: { visuals: { plugins: Record<string, {
            create(options: powerbi.extensibility.visual.VisualConstructorOptions): powerbi.extensibility.visual.IVisual
        }> } };
        harness: BrowserHarness;
        harnesses: Record<string, BrowserHarness>;
        packagedVisual: PackageInfo;
    }
}

export async function mount(page: Page, fixture: Fixture = {}, hostOptions: HostOptions = {}, elementId = "visual"): Promise<string[]> {
    const requests: string[] = [];
    if (elementId === "visual") {
        page.on("request", request => requests.push(request.url()));
        await page.route("**/*", route => route.abort());
        await page.setContent("<!doctype html><html><head></head><body style='margin:0'></body></html>");
        const packaged = await readPackagedVisual();
        test.info().annotations.push({ type: "pbiviz", description: `${packaged.info.version} SHA256 ${packaged.info.sha256}` });
        await page.evaluate(info => {
            window.powerbi = { visuals: { plugins: {} } } as typeof window.powerbi;
            window.harnesses = {};
            window.packagedVisual = info;
        }, packaged.info);
        await page.addStyleTag({ content: packaged.css });
        await page.addScriptTag({ content: packaged.js });
    }
    await page.evaluate(({ guid, fixture, options, elementId }) => {
        const log: HostLog = { select: [], clear: 0, context: [], fetch: [], tooltip: [], events: [], failures: [], localization: [], persisted: [] };
        let selected: Identity[] = [];
        let callback: (ids: Identity[]) => void = () => undefined;
        const ids: Identity[] = [];
        const identityParts = new Map<string, Parts>();
        const identity = (parts: Parts): Identity => {
            const key = JSON.stringify(Object.entries(parts).sort(([a], [b]) => a.localeCompare(b)));
            identityParts.set(key, parts);
            const id: Identity = {
                getKey: () => key,
                equals: other => key === other.getKey(),
                includes: other => {
                    const compared = identityParts.get(other.getKey()) ?? {};
                    return Object.keys(parts).length > 0 &&
                        Object.entries(parts).every(([name, value]) => compared[name] === value);
                },
                hasIdentity: () => Object.keys(parts).length > 0,
                getSelector: () => ({ data: Object.entries(parts).filter(([name]) => name !== "measure")
                    .map(([, value]) => ({ key: value })), metadata: parts.measure }),
                getSelectorsByColumn: () => ({
                    dataMap: Object.fromEntries(Object.entries(parts).filter(([name]) => name !== "measure")
                        .map(([name, value]) => [name, { key: value }])),
                    metadata: parts.measure
                })
            };
            ids.push(id);
            return id;
        };
        const builder = (): powerbi.visuals.ISelectionIdBuilder => {
            const parts: Parts = {};
            return {
                withCategory(column, index) {
                    const native = column.identity?.[index];
                    if (native) parts.category = (native as { key: string }).key;
                    return this;
                },
                withSeries(_column, group) {
                    if (group.identity) parts.series = (group.identity as { key: string }).key;
                    return this;
                },
                withMeasure(measure) { parts.measure = measure; return this; },
                withMatrixNode() { throw new Error("Unexpected matrix binding"); },
                withTable() { throw new Error("Unexpected table binding"); },
                createSelectionId() { return identity({ ...parts }); }
            };
        };
        const manager: NativePromiseManager = {
            select(input, multiple = false) {
                const incoming = (Array.isArray(input) ? input : [input]) as Identity[];
                log.select.push(...incoming.map(id => ({ key: id.getKey(), multiple })));
                if (options.rejectInteractions) return Promise.reject(new Error("Selection rejected"));
                selected = multiple ? [...selected.filter(old => !incoming.some(id => id.equals(old))),
                    ...incoming.filter(id => !selected.some(old => id.equals(old)))] : incoming;
                return Promise.resolve(selected);
            },
            clear() {
                log.clear++;
                if (options.rejectInteractions) return Promise.reject(new Error("Clear rejected"));
                selected = [];
                return Promise.resolve({});
            },
            hasSelection: () => selected.length > 0,
            getSelectionIds: () => selected,
            registerOnSelectCallback: handler => { callback = handler; },
            showContextMenu(id, position) {
                log.context.push({ key: (id as Identity).getKey(), ...position });
                return options.rejectInteractions ? Promise.reject(new Error("Context rejected")) : Promise.resolve({});
            },
            toggleExpandCollapse: () => Promise.resolve({})
        };
        const palette: powerbi.extensibility.ISandboxExtendedColorPalette = {
            isHighContrast: options.highContrast ?? false,
            foreground: { value: "#ffff00" }, background: { value: "#000000" },
            foregroundSelected: { value: "#ffffff" }, hyperlink: { value: "#00ffff" },
            foregroundLight: { value: "#ffff00" }, foregroundDark: { value: "#ffff00" },
            foregroundNeutralLight: { value: "#ffff00" }, foregroundNeutralDark: { value: "#ffff00" },
            foregroundNeutralSecondary: { value: "#ffff00" }, foregroundNeutralSecondaryAlt: { value: "#ffff00" },
            foregroundNeutralSecondaryAlt2: { value: "#ffff00" }, foregroundNeutralTertiary: { value: "#ffff00" },
            foregroundNeutralTertiaryAlt: { value: "#ffff00" }, foregroundButton: { value: "#ffff00" },
            backgroundLight: { value: "#000000" }, backgroundNeutral: { value: "#000000" }, backgroundDark: { value: "#000000" },
            visitedHyperlink: { value: "#00ffff" }, mapPushpin: { value: "#ffff00" }, shapeStroke: { value: "#ffff00" },
            getColor: () => ({ value: "#1665a7" }),
            reset() { return this; }
        };
        const host: Pick<powerbi.extensibility.visual.IVisualHost, "createSelectionIdBuilder" | "createSelectionManager" |
            "locale" | "instanceId" | "hostCapabilities" | "colorPalette" | "eventService" | "tooltipService" |
            "fetchMoreData" | "createLocalizationManager" | "persistProperties"> = {
            createSelectionIdBuilder: builder,
            // Power BI's legacy IPromise declaration differs from the native Promise used by this host double.
            createSelectionManager: () => manager as unknown as powerbi.extensibility.ISelectionManager,
            locale: options.locale ?? "en-US",
            instanceId: options.instanceId ?? "browser:packaged-instance/one",
            hostCapabilities: { allowInteractions: options.allowInteractions ?? true },
            colorPalette: palette,
            eventService: {
                renderingStarted: () => { log.events.push("started"); },
                renderingFinished: () => { log.events.push("finished"); },
                renderingFailed: (_event, reason) => { log.events.push("failed"); log.failures.push(reason ?? "unknown"); }
            },
            tooltipService: {
                enabled: () => options.tooltipEnabled ?? true,
                show: event => { log.tooltip.push({ kind: "show", keys: event.identities?.map(id => (id as Identity).getKey()),
                    dataItems: event.dataItems, coordinates: event.coordinates, isTouchEvent: event.isTouchEvent }); },
                move: event => { log.tooltip.push({ kind: "move", keys: event.identities?.map(id => (id as Identity).getKey()),
                    coordinates: event.coordinates, isTouchEvent: event.isTouchEvent }); },
                hide: event => { log.tooltip.push({ kind: "hide", immediately: event.immediately, isTouchEvent: event.isTouchEvent }); }
            },
            fetchMoreData: aggregate => { log.fetch.push(aggregate); return options.fetchResult ?? false; },
            persistProperties: changes => { log.persisted.push(changes); },
            createLocalizationManager: () => ({
                getDisplayName: key => { log.localization.push(key); return key; }
            })
        };
        const dataView = (input: Fixture): powerbi.DataView => {
            const segments = input.segments ?? ["Enterprise", "Consumer"];
            const names = input.components ?? ["Services", "Products"];
            const raw = input.values ?? [[30, 10], [20, 40]];
            const dynamicFormat = input.dynamicFormat;
            const category: powerbi.DataViewCategoryColumn = {
                source: { displayName: "Segment", queryName: "Facts.Segment", roles: { segment: true }, format: input.categoryFormat },
                values: segments as powerbi.PrimitiveValue[],
                identity: input.noCategoryIdentity ? undefined : segments.map((_, index) =>
                    ({ key: `category-${input.duplicateCategoryIdentity ? 0 : index}` }))
            };
            const groups: powerbi.DataViewValueColumnGroup[] = names.map((name, component) => ({
                name: name ?? undefined,
                identity: input.noSeriesIdentity ? undefined : { key: `series-${component}` },
                values: [{
                    source: { displayName: "Revenue", queryName: "Facts.Revenue", isMeasure: true,
                        roles: { value: !input.invalidBinding }, format: input.format ?? "#,0.00", groupName: name ?? undefined },
                    values: segments.map((_, segment) => raw[segment]?.[component] ?? null) as powerbi.PrimitiveValue[],
                    highlights: input.highlights ?
                        segments.map((_, segment) => input.highlights?.[segment]?.[component] ?? null) as powerbi.PrimitiveValue[] : undefined,
                    objects: dynamicFormat ? segments.map(() => ({ general: { formatString: dynamicFormat } })) : undefined
                }]
            }));
            const values = groups.flatMap(group => group.values) as powerbi.DataViewValueColumns;
            values.source = { displayName: "Component", queryName: "Facts.Component", roles: { component: true }, format: input.componentFormat };
            values.grouped = () => groups;
            return {
                metadata: { columns: [category.source, values.source, ...values.map(column => column.source)],
                    segment: input.partial ? {} : undefined,
                    objects: { dataContract: { additiveConfirmed: input.additive ?? true }, appearance: {
                        showTable: input.showTable ?? false, showLabels: input.showLabels ?? true,
                        labelContent: input.labelContent ?? "segmentShare", direction: input.direction ?? "auto",
                        fontSize: input.fontSize ?? 12, minLabelWidth: input.minLabelWidth ?? 48
                    } } },
                categorical: { categories: [category], values }
            };
        };
        const plugin = window.powerbi.visuals.plugins[guid];
        if (!plugin) throw new Error("Packaged script did not register the Power BI visual plugin");
        const element = document.createElement("div");
        element.id = elementId;
        document.body.append(element);
        const visual = plugin.create({ element, host: host as powerbi.extensibility.visual.IVisualHost });
        let current = fixture;
        let viewport = { width: 900, height: 650 };
        let preparedView: powerbi.DataView | undefined;
        window.harness = {
            visual, log, ids,
            update(next = current, width = viewport.width, height = viewport.height, append = false) {
                current = next;
                viewport = { width, height };
                visual.update({ dataViews: [dataView(current)], viewport, type: 2, operationKind: append ? 1 : 0 });
            },
            resize(width, height) {
                viewport = { width, height };
                visual.update({ dataViews: [], viewport, type: 4 });
            },
            clearData() { visual.update({ dataViews: [], viewport, type: 2 }); },
            external(parts) { selected = parts.map(identity); callback(selected); },
            setHostOptions(next) { Object.assign(options, next); },
            resetHistory() {
                log.select.length = log.context.length = log.fetch.length = log.tooltip.length = 0;
                log.events.length = log.failures.length = log.localization.length = ids.length = 0;
                log.persisted.length = 0;
                log.clear = 0;
            },
            prepare(next, width, height) {
                current = next;
                viewport = { width, height };
                preparedView = dataView(next);
            },
            updatePrepared() {
                if (!preparedView) throw new Error("Prepare the fixture before measuring");
                visual.update({ dataViews: [preparedView], viewport, type: 2, operationKind: 0 });
            }
        };
        window.harnesses[elementId] = window.harness;
        window.harness.update();
    }, { guid: GUID, fixture, options: hostOptions, elementId });
    return requests;
}

export async function hostLog(page: Page): Promise<HostLog> {
    return page.evaluate(() => window.harness.log);
}

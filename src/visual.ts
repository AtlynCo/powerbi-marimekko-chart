import powerbi from "powerbi-visuals-api";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { convert } from "./data";
import { LIMITS, sum, type Cell, type ChartModel, type Entity, type Identity, type Segment } from "./model";
import { dictionary } from "./i18n";
import { DEFAULTS, formattingModel, readSettings, type Settings } from "./settings";
import { NOTICES } from "./notices";
import "../style/visual.less";

const SVG_NS = "http://www.w3.org/2000/svg";
const COLORS = ["#1665a7", "#c75619", "#268273", "#8b50a1", "#a88112", "#bd4374", "#536ca9", "#597d26"];
let instanceSequence = 0;
type Target = HTMLElement | SVGElement;
type SelectionTarget = { node: Target; identity: Identity };

function html<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
}
function hash(key: string): number {
    let value = 2166136261;
    for (let i = 0; i < key.length; i++) value = Math.imul(value ^ key.charCodeAt(i), 16777619);
    return value >>> 0;
}
function nativeIdentity(id: powerbi.extensibility.ISelectionId): id is Identity {
    return "includes" in id && typeof id.includes === "function" && "getKey" in id && typeof id.getKey === "function";
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: powerbi.extensibility.visual.IVisualHost;
    private readonly root: HTMLDivElement;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private settings: Settings = DEFAULTS;
    private model: ChartModel | undefined;
    private view: powerbi.DataView | undefined;
    private viewport = { width: 0, height: 0 };
    private targets: SelectionTarget[] = [];
    private chartCells: { cell: Cell; node: SVGRectElement }[] = [];
    private tableOpen = false;
    private noticesOpen = false;
    private infoOpen = false;
    private texts = dictionary("en");
    private locale = "";
    private readonly instanceSequence = ++instanceSequence;
    private formatted = new Map<string, string>();
    private rawLabels = new Map<Cell, string>();
    private cellLabels = new Map<Cell, string>();
    private tablePage = 0;
    private fetchCount = 0;
    private lastFetchRows = -1;
    private fetchPending = false;
    private fetchStopped = false;
    private destroyed = false;
    private interactionMessage = "";
    private focusKey = "";

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI host constructor options are required");
        this.host = options.host;
        this.locale = this.host.locale;
        this.texts = dictionary(this.host.locale);
        const localization = this.host.createLocalizationManager();
        const segmentName = localization.getDisplayName("Role_Segment");
        const componentName = localization.getDisplayName("Role_Component");
        this.texts = { ...this.texts,
            segment: segmentName && segmentName !== "Role_Segment" ? segmentName : this.texts.segment,
            component: componentName && componentName !== "Role_Component" ? componentName : this.texts.component };
        this.selection = this.host.createSelectionManager();
        this.root = html("div", "atlyn-marimekko");
        this.root.setAttribute("role", "region");
        this.root.setAttribute("aria-label", "Atlyn Marimekko");
        options.element.append(this.root);
        this.selection.registerOnSelectCallback(() => {
            if (!this.destroyed) this.paintSelection();
        });
        this.root.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault();
                this.clear();
            }
        });
    }

    public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
        if (this.destroyed) return;
        this.host.eventService.renderingStarted(options);
        try {
            if (!Number.isFinite(options.viewport.width) || !Number.isFinite(options.viewport.height)) {
                throw new Error("The host viewport must be finite");
            }
            this.viewport = { width: Math.max(0, options.viewport.width), height: Math.max(0, options.viewport.height) };
            const dataUpdate = (options.type & powerbi.VisualUpdateType.Data) !== 0;
            const localeChanged = this.locale !== this.host.locale;
            if (localeChanged) {
                this.locale = this.host.locale;
                this.texts = dictionary(this.locale);
            }
            const rebuildModel = dataUpdate || !!options.dataViews?.[0] || !this.model || localeChanged;
            if (options.dataViews?.[0] || dataUpdate) this.view = options.dataViews?.[0];
            const previousSettings = this.settings;
            this.settings = readSettings(this.view?.metadata.objects);
            if (previousSettings.showTable !== this.settings.showTable) this.tableOpen = this.settings.showTable;
            if (dataUpdate) {
                this.fetchPending = false;
                if (options.operationKind !== powerbi.VisualDataChangeOperationKind.Append) {
                    this.fetchCount = 0;
                    this.lastFetchRows = -1;
                    this.fetchStopped = false;
                    this.tablePage = 0;
                }
            }
            if (rebuildModel) {
                this.formatted.clear();
                this.rawLabels.clear();
                this.cellLabels.clear();
                this.model = convert(this.view, this.host, this.settings.additiveConfirmed, this.text.blankName);
            }
            if (dataUpdate) this.fetchMore();
            this.render();
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.model = undefined;
            this.targets = [];
            this.chartCells = [];
            this.fetchPending = false;
            this.formatted.clear();
            this.rawLabels.clear();
            this.cellLabels.clear();
            const message = html("p", "diagnostic render-error", this.text.error);
            message.setAttribute("role", "alert");
            this.root.replaceChildren(message);
            this.host.eventService.renderingFailed(options, error instanceof Error ? error.message : String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return formattingModel(this.settings, this.host.locale);
    }

    public destroy(): void {
        this.destroyed = true;
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        this.targets = [];
        this.chartCells = [];
        this.model = undefined;
        this.view = undefined;
        this.formatted.clear();
        this.rawLabels.clear();
        this.cellLabels.clear();
        this.root.remove();
    }

    private get text() { return this.texts; }
    private get rtl(): boolean {
        return this.settings.direction === "rtl" ||
            (this.settings.direction === "auto" && /^(ar|fa|he|ur)(-|$)/i.test(this.host.locale));
    }
    private get highContrast(): boolean { return this.host.colorPalette.isHighContrast; }
    private get compact(): boolean { return this.viewport.width < 440 || this.viewport.height < 340; }
    private get micro(): boolean { return this.viewport.width < 180 || this.viewport.height < 140; }
    private get foreground(): string { return this.highContrast ? this.host.colorPalette.foreground.value : "#172b3a"; }
    private get background(): string { return this.highContrast ? this.host.colorPalette.background.value : "#ffffff"; }
    private color(component: Entity): string { return COLORS[hash(component.key) % COLORS.length] ?? COLORS[0]!; }
    private code(component: Entity): string { return `${(this.model?.components.indexOf(component) ?? -1) + 1}`; }
    private raw(cell: Cell): string {
        if (cell.status === "blank") return this.text.missing;
        if (cell.status === "invalid") return this.text.invalidValue;
        let label = this.rawLabels.get(cell);
        if (label === undefined) {
            label = this.number(cell.value!, cell.format);
            this.rawLabels.set(cell, label);
        }
        return label;
    }
    private percent(value: number | null): string {
        return value === null ? this.text.unavailable : this.number(value, "0.0%");
    }
    private number(value: number, format?: string): string {
        if (!Number.isFinite(value)) return this.text.unavailable;
        const key = JSON.stringify([format, value]);
        let formatted = this.formatted.get(key);
        if (formatted === undefined) {
            formatted = valueFormatter.format(value, format, false, this.host.locale);
            this.formatted.set(key, formatted);
        }
        return formatted;
    }
    private get totalsValid(): boolean {
        return !!this.model && !this.model.diagnostics.some(item => ["confirm", "ratio", "invalid", "identity", "range"].includes(item.code));
    }

    private fetchMore(): void {
        if (!this.view?.metadata.segment || !this.model || !this.settings.additiveConfirmed ||
            this.model.diagnostics.some(item => ["binding", "invalid", "ratio", "identity", "range", "limit"].includes(item.code))) return;
        const rows = this.view.categorical?.categories?.find(column => column.source.roles?.segment)?.values.length ?? 0;
        const components = this.view.categorical?.values?.grouped().length ?? 0;
        if (rows >= LIMITS.segments || rows * components >= LIMITS.cells || components > LIMITS.components) {
            if (!this.model.diagnostics.some(item => item.code === "limit")) this.model.diagnostics.push({ code: "limit" });
            return;
        }
        if (this.fetchCount >= LIMITS.fetches || rows <= this.lastFetchRows) {
            this.fetchStopped = true;
            return;
        }
        this.lastFetchRows = rows;
        this.fetchCount++;
        // The host merges cumulative segments, including overlap. Never append the same data locally.
        this.fetchPending = this.host.fetchMoreData(true);
        this.fetchStopped = !this.fetchPending;
    }

    private render(): void {
        const model = this.model;
        if (!model) return;
        const active = document.activeElement;
        const activeKey = active instanceof Element && this.root.contains(active) ? active.getAttribute("data-focus") : null;
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        this.root.replaceChildren();
        this.targets = [];
        this.chartCells = [];
        this.root.dir = this.rtl ? "rtl" : "ltr";
        this.root.style.width = `${this.viewport.width}px`;
        this.root.style.height = `${this.viewport.height}px`;
        this.root.style.setProperty("--ink", this.foreground);
        this.root.style.setProperty("--paper", this.background);
        this.root.style.fontSize = `${this.settings.fontSize}px`;
        this.root.classList.toggle("high-contrast", this.highContrast);
        this.root.classList.toggle("compact", this.compact);
        this.root.classList.toggle("micro", this.micro);
        this.root.classList.toggle("no-geometry", !model.drawable);
        this.root.classList.toggle("table-open", this.tableOpen);
        const header = html("div", "header");
        const heading = html("strong", this.micro ? "title sr-only" : "title", this.compact ? "Marimekko" : this.text.title);
        heading.title = this.text.title;
        header.append(heading);
        const controls = html("div", "controls");
        const clear = this.button(this.compact ? this.text.clearShort : this.text.clear, () => this.clear(), "clear");
        clear.className = "clear-control";
        clear.setAttribute("aria-label", this.text.clear);
        clear.hidden = this.compact && !this.selection.hasSelection();
        controls.append(clear);
        const toggle = this.button(this.tableOpen ? this.text.hideTable : this.text.showTable, () => {
            this.tableOpen = !this.tableOpen;
            this.settings = { ...this.settings, showTable: this.tableOpen };
            this.host.persistProperties({ merge: [{
                objectName: "appearance", selector: {}, properties: { showTable: this.tableOpen }
            }] });
            this.render();
        }, "table-toggle");
        toggle.textContent = this.compact ? this.tableOpen ? this.text.chartShort : this.text.dataShort :
            this.tableOpen ? this.text.hideTable : this.text.showTable;
        toggle.setAttribute("aria-label", this.tableOpen ? this.text.hideTable : this.text.showTable);
        toggle.setAttribute("aria-expanded", String(this.tableOpen));
        controls.append(toggle);
        const information = this.button(this.text.infoShort, () => {
            this.infoOpen = !this.infoOpen;
            this.render();
        }, "info-toggle");
        information.setAttribute("aria-label", this.text.info);
        information.setAttribute("aria-expanded", String(this.infoOpen));
        controls.append(information);
        header.append(controls);
        this.root.append(header);
        if (this.infoOpen) {
            const informationPanel = html("section", "information");
            informationPanel.append(html("h2", undefined, this.text.info),
                html("p", "encoding", this.text.encoding), html("p", undefined, this.text.instruction),
                html("p", undefined, this.text.narrowHelp));
            for (const diagnostic of model.diagnostics) informationPanel.append(html("p", "diagnostic", this.text[diagnostic.code]));
            if (model.partial) informationPanel.append(html("p", "denominator", this.text.subsetEncoding));
            const notices = this.button(this.text.notices, () => { this.noticesOpen = !this.noticesOpen; this.render(); }, "notices-toggle");
            notices.setAttribute("aria-expanded", String(this.noticesOpen));
            informationPanel.append(notices);
            if (this.noticesOpen) informationPanel.append(html("pre", "notices", NOTICES));
            this.root.append(informationPanel);
            this.restoreFocus(activeKey);
            return;
        }
        if (!this.micro) this.root.append(html("p", "encoding", this.compact ? this.text.encodingShort : this.text.encoding));
        const status = html("div", "status");
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        if (model.diagnostics.length > 1) status.tabIndex = 0;
        for (const diagnostic of model.diagnostics) {
            const message = this.text[diagnostic.code];
            const compactMessage = diagnostic.code === "partial" ? this.text.partialShort :
                diagnostic.code === "blank" ? this.text.blankShort : diagnostic.code === "limit" ? this.text.limitShort : message;
            const item = html("p", `diagnostic ${diagnostic.code}`,
                `${this.compact && model.drawable ? compactMessage : message}${diagnostic.count ? ` (${diagnostic.count})` : ""}`);
            item.title = message;
            status.append(item);
        }
        if (model.partial && !this.compact) status.append(html("p", "denominator", this.text.subsetEncoding));
        if (this.fetchPending) status.append(html("p", "fetch", this.compact ? this.text.loadingShort : this.text.fetchPending));
        if (this.fetchStopped) status.append(html("p", "diagnostic", this.compact ? this.text.stoppedShort : this.text.fetchStopped));
        if (this.interactionMessage) status.append(html("p", "diagnostic interaction-error", this.interactionMessage));
        this.root.append(status);
        if (this.micro && !this.tableOpen) {
            this.root.append(html("p", "small-state", this.text.smallShort));
        } else if (model.drawable && (!this.tableOpen || !this.compact)) {
            const firstCell = model.segments[0]?.cells[0];
            this.root.append(html("p", "total", `${this.compact ? this.text.totalShort : this.text.total}: ${this.number(model.total, firstCell?.format)}`));
            this.renderLegend(model);
            const plot = html("div", "plot-container");
            this.root.append(plot);
            if (model.segments.length && this.tableOpen) this.renderTable(model);
            this.renderChart(model, plot);
        } else if (!model.drawable && model.diagnostics.some(diagnostic => diagnostic.code === "binding")) {
            const onboarding = html("div", "onboarding");
            onboarding.append(html("strong", undefined, this.text.getStarted),
                html("p", undefined, this.text.bindingHelp), html("p", undefined, this.text.sampleHelp));
            this.root.append(onboarding);
        }
        if (model.segments.length && (!model.drawable || this.compact || !this.tableOpen)) this.renderTable(model);
        this.paintSelection();
        this.restoreFocus(activeKey);
    }

    private restoreFocus(activeKey: string | null): void {
        if (activeKey) {
            const candidate = Array.from(this.root.querySelectorAll<Target>("[data-focus]"))
                .find(node => node.getAttribute("data-focus") === activeKey);
            if (candidate && !(candidate instanceof HTMLButtonElement && candidate.disabled)) candidate.focus();
            else this.root.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
        }
    }

    private button(label: string, action: () => void, focusKey: string): HTMLButtonElement {
        const node = html("button", undefined, label);
        node.type = "button";
        node.setAttribute("data-focus", focusKey);
        node.addEventListener("click", action);
        return node;
    }

    private renderLegend(model: ChartModel): void {
        const legend = html("div", "legend");
        legend.setAttribute("aria-label", this.text.legendShares);
        const caption = html("span", "legend-caption", this.compact ? this.text.legendShort : this.text.legendShares);
        caption.title = this.text.legendShares;
        legend.append(caption);
        for (const [componentIndex, component] of model.components.entries()) {
            const total = sum(model.segments.map(segment => segment.cells[componentIndex]?.value ?? 0));
            const button = html("button", "legend-item");
            button.type = "button";
            const swatch = svg("svg", { class: "swatch", width: 12, height: 12 });
            swatch.append(svg("rect", { width: 12, height: 12,
                fill: this.highContrast ? `url(#${this.patternPrefix}-${hash(component.key)})` : this.color(component) }));
            swatch.setAttribute("aria-hidden", "true");
            button.append(swatch, html("span", undefined, `${this.code(component)}. ${component.label}`),
                html("span", "legend-share", this.percent(total / model.total)));
            button.title = component.label;
            this.bind(button, component.identity, `component-${component.key}`);
            this.hostTooltip(button, component.identity, () => [
                { displayName: this.text.component, value: component.label },
                { displayName: this.text.total, value: this.number(total, model.segments[0]?.cells[componentIndex]?.format) },
                { displayName: model.partial ? this.text.subsetShare : this.text.overallShare, value: this.percent(total / model.total) },
                { displayName: this.text.title, value: model.partial ? this.text.subsetEncoding : this.text.encoding }
            ]);
            legend.append(button);
        }
        this.root.append(legend);
    }

    private renderChart(model: ChartModel, container: HTMLDivElement): void {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const footer = this.compact ? 30 : 44;
        const plotHeight = height - footer;
        if (width < 120 || plotHeight < 32) {
            container.append(html("p", "small-state", this.text.small));
            return;
        }
        const chart = svg("svg", { class: "chart", width, height, viewBox: `0 0 ${width} ${height}`,
            "data-plot-width": width, "data-plot-height": plotHeight,
            role: "group", "aria-label": `${this.text.title}. ${this.text.instruction}` });
        const defs = svg("defs");
        for (const component of model.components) {
            const key = hash(component.key);
            const size = 5 + key % 7;
            const pattern = svg("pattern", { id: `${this.patternPrefix}-${key}`, width: size, height: size,
                patternUnits: "userSpaceOnUse", patternTransform: `rotate(${key % 2 ? 45 : -45})` });
            pattern.append(svg("rect", { width: size, height: size, fill: this.background }),
                svg("line", { x1: 0, y1: 0, x2: 0, y2: size, stroke: this.foreground, "stroke-width": 2 }));
            defs.append(pattern);
        }
        chart.append(defs);
        const background = svg("rect", { class: "chart-background", width, height: plotHeight, fill: this.background });
        background.addEventListener("click", () => this.clear());
        background.addEventListener("contextmenu", event => {
            if (!(event instanceof MouseEvent)) return;
            event.preventDefault();
            this.context(this.host.createSelectionIdBuilder().createSelectionId(), event.clientX, event.clientY);
        });
        chart.append(background);
        for (const segment of model.segments) {
            if (!segment.width) continue;
            const x = (this.rtl ? 1 - segment.x - segment.width : segment.x) * width;
            const w = segment.width * width;
            for (const cell of segment.cells) {
                if (!cell.height) continue;
                const component = model.components[cell.componentIndex];
                if (!component) continue;
                const y = cell.y * plotHeight;
                const h = (cell.y + cell.height) * plotHeight - y;
                const fill = this.highContrast ? `url(#${this.patternPrefix}-${hash(component.key)})` : this.color(component);
                const rect = svg("rect", { class: "cell", x, y, width: w, height: h, fill,
                    "data-segment": cell.segmentIndex, "data-component": cell.componentIndex,
                    "data-value": cell.value ?? "", "data-share": cell.overallShare ?? "",
                    "aria-label": this.cellLabel(cell, segment, component) });
                if (model.hasHighlights) rect.classList.add("highlight-base");
                this.bind(rect, cell.identity, `cell-${cell.identity.getKey()}`);
                rect.setAttribute("tabindex", this.focusKey === cell.identity.getKey() || !this.chartCells.length ? "0" : "-1");
                rect.addEventListener("focus", () => {
                    this.focusKey = cell.identity.getKey();
                    for (const entry of this.chartCells) entry.node.setAttribute("tabindex", entry.node === rect ? "0" : "-1");
                });
                rect.addEventListener("keydown", event => this.navigateCells(event, cell));
                this.tooltip(rect, cell, segment, component);
                chart.append(rect);
                this.chartCells.push({ cell, node: rect });
                if (model.hasHighlights && cell.highlight !== null && cell.highlight > 0 && segment.total > 0) {
                    const highlightHeight = cell.highlight / segment.total * plotHeight;
                    const overlay = svg("rect", { class: "highlight-overlay", x, y: y + h - highlightHeight,
                        width: w, height: highlightHeight, fill, "aria-hidden": "true", "pointer-events": "none" });
                    chart.append(overlay);
                    this.targets.push({ node: overlay, identity: cell.identity });
                }
                if (this.settings.showLabels && w >= this.settings.minLabelWidth && h >= this.settings.fontSize + 10) {
                    const value = this.settings.labelContent === "raw" ? this.raw(cell) :
                        this.percent(this.settings.labelContent === "overallShare" ? cell.overallShare : cell.segmentShare);
                    const label = svg("text", { class: "cell-label", x: x + w / 2, y: y + h / 2,
                        "text-anchor": "middle", "dominant-baseline": "central", "pointer-events": "none", "aria-hidden": "true" });
                    const showName = w >= 110 && h >= this.settings.fontSize * 3.2;
                    label.textContent = showName ? value : `${this.code(component)}: ${value}`;
                    label.classList.toggle("value-label", showName);
                    if (showName) {
                        const name = svg("text", { class: "cell-name", x: x + w / 2,
                            y: y + h / 2 - this.settings.fontSize * .9, "text-anchor": "middle",
                            "pointer-events": "none", "aria-hidden": "true" });
                        name.textContent = component.label;
                        chart.append(name);
                        this.fitText(name, w - 12);
                        label.setAttribute("y", String(y + h / 2 + this.settings.fontSize * .55));
                    }
                    chart.append(label);
                    this.fitText(label, w - 12);
                }
            }
            if (w >= this.settings.minLabelWidth) {
                const label = svg("text", { class: "segment-label", x: x + w / 2, y: plotHeight + (this.compact ? 13 : 17),
                    "text-anchor": "middle", "aria-label": `${segment.label}. ${this.text.width}: ${this.percent(segment.width)}` });
                label.textContent = segment.label;
                this.bind(label, segment.identity, `segment-${segment.key}`);
                this.hostTooltip(label, segment.identity, () => [
                    { displayName: this.text.segment, value: segment.label },
                    { displayName: this.text.segmentTotal, value: this.number(segment.total, segment.cells[0]?.format) },
                    { displayName: this.text.width, value: this.percent(segment.width) },
                    { displayName: this.text.title, value: model.partial ? this.text.subsetEncoding : this.text.encoding }
                ]);
                chart.append(label);
                this.fitText(label, w - 10);
                const share = svg("text", { class: "width-label", x: x + w / 2,
                    y: plotHeight + (this.compact ? 27 : 35), "text-anchor": "middle", "aria-hidden": "true" });
                share.textContent = this.compact ? this.percent(segment.width) :
                    `${this.number(segment.total, segment.cells[0]?.format)} | ${this.percent(segment.width)}`;
                chart.append(share);
                this.fitText(share, w - 10);
            }
        }
        chart.addEventListener("click", event => {
            if (event.target === chart) this.clear();
        });
        container.append(chart);
        const focus = this.chartCells.find(entry => entry.cell.identity.getKey() === this.focusKey) ?? this.chartCells[0];
        for (const entry of this.chartCells) {
            entry.node.setAttribute("tabindex", entry === focus && this.host.hostCapabilities.allowInteractions !== false ? "0" : "-1");
        }
        // Measurement must happen after attachment to the DOM.
        const overflow = Array.from(chart.querySelectorAll<SVGTextElement>("text[data-max-width]"))
            .filter(label => label.getComputedTextLength() > Number(label.getAttribute("data-max-width")));
        for (const label of overflow) label.remove();
    }

    private get patternPrefix(): string {
        return `atlyn-${this.host.instanceId.replace(/[^a-zA-Z0-9_-]/g, "")}-${this.instanceSequence}`;
    }
    private fitText(node: SVGTextElement, maxWidth: number): void {
        node.setAttribute("data-max-width", String(maxWidth));
    }

    private navigateCells(event: KeyboardEvent, cell: Cell): void {
        const horizontal = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const vertical = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (!horizontal && !vertical && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        let next: { cell: Cell; node: SVGRectElement } | undefined;
        if (event.key === "Home") next = this.chartCells[0];
        else if (event.key === "End") next = this.chartCells[this.chartCells.length - 1];
        else {
            const dx = this.rtl ? -horizontal : horizontal;
            next = this.chartCells.filter(entry => horizontal ?
                entry.cell.componentIndex === cell.componentIndex && (entry.cell.segmentIndex - cell.segmentIndex) * dx > 0 :
                entry.cell.segmentIndex === cell.segmentIndex && (entry.cell.componentIndex - cell.componentIndex) * vertical > 0)
                .sort((a, b) => horizontal ? Math.abs(a.cell.segmentIndex - cell.segmentIndex) - Math.abs(b.cell.segmentIndex - cell.segmentIndex) :
                    Math.abs(a.cell.componentIndex - cell.componentIndex) - Math.abs(b.cell.componentIndex - cell.componentIndex))[0];
        }
        next?.node.focus();
    }

    private cellLabel(cell: Cell, segment: Segment, component: Entity): string {
        let label = this.cellLabels.get(cell);
        if (label !== undefined) return label;
        label = `${segment.label}; ${component.label}; ${this.text.raw}: ${this.raw(cell)}; ` +
            `${this.text.segmentShare}: ${this.percent(cell.segmentShare)}; ` +
            `${this.model?.partial ? this.text.subsetShare : this.text.overallShare}: ${this.percent(cell.overallShare)}`;
        this.cellLabels.set(cell, label);
        return label;
    }

    private tooltip(node: Target, cell: Cell, segment: Segment, component: Entity): void {
        let cached: powerbi.extensibility.VisualTooltipDataItem[] | undefined;
        const items = (): powerbi.extensibility.VisualTooltipDataItem[] => {
            if (cached) return cached;
            cached = [
            { displayName: this.text.segment, value: segment.label },
            { displayName: this.text.component, value: component.label },
            { displayName: this.text.raw, value: this.raw(cell) },
            { displayName: this.text.segmentTotal, value: this.totalsValid ? this.number(segment.total, cell.format) : this.text.unavailable },
            { displayName: this.text.width, value: this.model?.drawable ? this.percent(segment.width) : this.text.unavailable },
            { displayName: this.text.segmentShare, value: this.percent(cell.segmentShare) },
            { displayName: this.model?.partial ? this.text.subsetShare : this.text.overallShare, value: this.percent(cell.overallShare) },
            { displayName: this.text.title, value: this.model?.partial ? this.text.subsetEncoding : this.text.encoding }
            ];
            if (this.model?.hasHighlights) {
                cached.push({ displayName: this.text.highlighted, value: cell.highlight === null ? this.text.missing : this.number(cell.highlight, cell.format) },
                { displayName: this.text.highlightedShare, value: this.percent(segment.total && cell.highlight !== null ? cell.highlight / segment.total : null) });
            }
            return cached;
        };
        this.hostTooltip(node, cell.identity, items);
    }

    private hostTooltip(node: Target, identity: Identity, items: () => powerbi.extensibility.VisualTooltipDataItem[]): void {
        let isTouch = false;
        node.addEventListener("pointerenter", event => {
            if (!(event instanceof PointerEvent)) return;
            if (!this.host.tooltipService.enabled()) return;
            isTouch = event.pointerType === "touch";
            this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: isTouch,
                identities: [identity], dataItems: items() });
        });
        node.addEventListener("pointermove", event => {
            if (!(event instanceof PointerEvent)) return;
            if (!this.host.tooltipService.enabled()) return;
            this.host.tooltipService.move({ coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch",
                identities: [identity] });
        });
        node.addEventListener("pointerleave", () => this.host.tooltipService.hide({ immediately: false, isTouchEvent: isTouch }));
        node.addEventListener("pointercancel", () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: isTouch }));
        node.addEventListener("focus", () => {
            if (!this.host.tooltipService.enabled()) return;
            const bounds = node.getBoundingClientRect();
            this.host.tooltipService.show({ coordinates: [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
                isTouchEvent: false, identities: [identity], dataItems: items() });
        });
        node.addEventListener("blur", () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }));
    }

    private bind(node: Target, identity: Identity, focus: string): void {
        this.targets.push({ node, identity });
        node.setAttribute("role", "button");
        node.setAttribute("tabindex", "0");
        node.setAttribute("aria-pressed", "false");
        node.setAttribute("data-focus", focus);
        if (this.host.hostCapabilities.allowInteractions === false) {
            node.setAttribute("aria-disabled", "true");
            node.setAttribute("tabindex", "-1");
            return;
        }
        node.addEventListener("click", event => {
            if (!(event instanceof MouseEvent)) return;
            event.stopPropagation();
            this.select(identity, event.ctrlKey || event.metaKey);
        });
        node.addEventListener("contextmenu", event => {
            if (!(event instanceof MouseEvent)) return;
            event.preventDefault();
            event.stopPropagation();
            this.context(identity, event.clientX, event.clientY);
        });
        node.addEventListener("keydown", event => {
            if (!(event instanceof KeyboardEvent)) return;
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                this.select(identity, event.ctrlKey || event.metaKey);
            } else if (event.key === "F10" && event.shiftKey) {
                event.preventDefault();
                const bounds = node.getBoundingClientRect();
                this.context(identity, bounds.left, bounds.bottom);
            }
        });
    }

    private select(identity: Identity, multiple: boolean): void {
        if (this.host.hostCapabilities.allowInteractions === false) return;
        this.selection.select(identity, multiple).then(() => this.interactionSucceeded(), () => this.interactionFailed());
    }
    private clear(): void {
        if (this.host.hostCapabilities.allowInteractions === false) return;
        this.selection.clear().then(() => this.interactionSucceeded(), () => this.interactionFailed());
    }
    private context(identity: Identity, x: number, y: number): void {
        if (this.host.hostCapabilities.allowInteractions === false) return;
        this.selection.showContextMenu(identity, { x, y }).then(() => this.interactionSucceeded(), () => this.interactionFailed());
    }
    private interactionSucceeded(): void {
        if (this.destroyed) return;
        this.interactionMessage = "";
        this.root.querySelector(".interaction-error")?.remove();
        this.paintSelection();
    }
    private interactionFailed(): void {
        if (this.destroyed) return;
        this.interactionMessage = this.text.interactionError;
        this.render();
    }
    private paintSelection(): void {
        if (this.destroyed) return;
        const ids = this.selection.getSelectionIds().filter(nativeIdentity);
        const clear = this.root.querySelector<HTMLButtonElement>(".clear-control");
        if (clear) clear.hidden = this.compact && ids.length === 0;
        for (const { node, identity } of this.targets) {
            const selected = ids.some(id => id.includes(identity) || identity.includes(id));
            node.classList.toggle("selected", selected);
            node.classList.toggle("muted", ids.length > 0 && !selected);
            if (node.getAttribute("role") === "button") node.setAttribute("aria-pressed", String(selected));
        }
    }

    private renderTable(model: ChartModel): void {
        const container = html("div", this.tableOpen ? "table-container" : "table-container sr-only");
        // Closed tables are a screen-reader summary only, not a second invisible keyboard tab sequence.
        if (!this.tableOpen) {
            container.append(html("p", undefined, `${this.text.total}: ${this.totalsValid ? this.number(model.total) : this.text.unavailable}. ` +
                `${model.segments.length} ${this.text.segment}, ${model.components.length} ${this.text.component}. ${this.text.showTable}.`));
            this.root.append(container);
            return;
        }
        const cells = model.segments.flatMap(segment => segment.cells);
        const pages = Math.max(1, Math.ceil(cells.length / LIMITS.tablePage));
        this.tablePage = Math.min(this.tablePage, pages - 1);
        const pager = html("div", "pager");
        const previous = this.button(this.text.previous, () => { this.tablePage--; this.render(); }, "previous");
        previous.disabled = this.tablePage === 0;
        const next = this.button(this.text.next, () => { this.tablePage++; this.render(); }, "next");
        next.disabled = this.tablePage >= pages - 1;
        pager.append(previous, html("span", undefined, `${this.text.page} ${this.tablePage + 1} / ${pages}`), next);
        container.append(pager);
        const table = html("table");
        table.append(html("caption", undefined, this.text.tableCaption));
        const head = html("thead");
        const headers = html("tr");
        for (const label of [this.text.segment, this.text.component, this.text.raw, this.text.segmentTotal, this.text.width,
            this.text.segmentShare, model.partial ? this.text.subsetShare : this.text.overallShare, this.text.highlighted]) {
            const th = html("th", undefined, label);
            th.scope = "col";
            headers.append(th);
        }
        head.append(headers);
        const body = html("tbody");
        for (const cell of cells.slice(this.tablePage * LIMITS.tablePage, (this.tablePage + 1) * LIMITS.tablePage)) {
            const segment = model.segments[cell.segmentIndex];
            const component = model.components[cell.componentIndex];
            if (!segment || !component) continue;
            const row = html("tr");
            const values: [string, Identity][] = [
                [segment.label, segment.identity], [`${this.code(component)} ${component.label}`, component.identity], [this.raw(cell), cell.identity]
            ];
            for (let i = 0; i < values.length; i++) {
                const entry = values[i];
                if (!entry) continue;
                const td = html("td");
                const button = html("button", "table-select", entry[0]);
                button.type = "button";
                if (model.diagnostics.some(item => item.code === "identity")) button.disabled = true;
                else this.bind(button, entry[1], `table-${cell.identity.getKey()}-${i}`);
                button.setAttribute("aria-label", i === 0 ? `${this.text.segment}: ${segment.label}` :
                    i === 1 ? `${this.text.component}: ${component.label}` : this.cellLabel(cell, segment, component));
                if (i === 2) this.tooltip(button, cell, segment, component);
                td.append(button);
                row.append(td);
            }
            row.append(html("td", undefined, this.totalsValid ? this.number(segment.total, cell.format) : this.text.unavailable),
                html("td", undefined, model.drawable ? this.percent(segment.width) : this.text.unavailable),
                html("td", undefined, this.percent(cell.segmentShare)), html("td", undefined, this.percent(cell.overallShare)),
                html("td", undefined, model.hasHighlights && cell.highlight !== null ? this.number(cell.highlight, cell.format) : this.text.unavailable));
            body.append(row);
        }
        table.append(head, body);
        container.append(table);
        this.root.append(container);
    }
}

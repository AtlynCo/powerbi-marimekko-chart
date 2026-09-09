import type powerbi from "powerbi-visuals-api";

export type Identity = powerbi.visuals.ISelectionId;
export const LIMITS = Object.freeze({ segments: 200, components: 40, cells: 4000, fetches: 8, tablePage: 100 });
export type DiagnosticCode = "binding" | "confirm" | "ratio" | "invalid" | "blank" | "zero" | "empty" |
    "partial" | "limit" | "identity" | "range" | "highlight" | "fetchStopped";
export interface Diagnostic { code: DiagnosticCode; count?: number }
export interface Entity { key: string; label: string; identity: Identity }
export interface InputCell { value: unknown; highlight?: unknown; identity: Identity; format?: string }
export interface InputSegment extends Entity { cells: InputCell[] }
export interface ModelInput {
    segments: InputSegment[];
    components: Entity[];
    hasHighlights: boolean;
    partial: boolean;
    reduced: boolean;
    additiveConfirmed: boolean;
    percentageMeasure: boolean;
    identityValid: boolean;
}
export interface Cell {
    identity: Identity;
    segmentIndex: number;
    componentIndex: number;
    value: number | null;
    status: "value" | "blank" | "invalid";
    highlight: number | null;
    format?: string;
    segmentShare: number | null;
    overallShare: number | null;
    y: number;
    height: number;
}
export interface Segment extends Entity { total: number; x: number; width: number; cells: Cell[] }
export interface ChartModel {
    segments: Segment[];
    components: Entity[];
    total: number;
    drawable: boolean;
    partial: boolean;
    hasHighlights: boolean;
    diagnostics: Diagnostic[];
}

function sum(values: number[]): number {
    let total = 0;
    let correction = 0;
    for (const value of values) {
        const adjusted = value - correction;
        const next = total + adjusted;
        correction = (next - total) - adjusted;
        total = next;
    }
    return total;
}

export function isPercentageFormat(format = ""): boolean {
    // Quoted literals and escaped percent signs are not percentage scaling.
    return /%/.test(format.replace(/"[^"]*"|'[^']*'|\\.|_./g, ""));
}

export function buildModel(input: ModelInput): ChartModel {
    const components = input.components.slice(0, LIMITS.components);
    const segmentLimit = Math.min(LIMITS.segments, Math.floor(LIMITS.cells / Math.max(1, components.length)));
    const reduced = input.reduced || components.length < input.components.length || input.segments.length > segmentLimit;
    const partial = input.partial || reduced;
    const diagnostics: Diagnostic[] = [];
    if (partial) diagnostics.push({ code: "partial" });
    if (reduced) diagnostics.push({ code: "limit" });
    if (!input.additiveConfirmed) diagnostics.push({ code: "confirm" });
    if (input.percentageMeasure) diagnostics.push({ code: "ratio" });
    if (!input.identityValid) diagnostics.push({ code: "identity" });
    let invalid = 0;
    let blanks = 0;
    let invalidHighlights = 0;
    const segments: Segment[] = input.segments.slice(0, segmentLimit).map((source, segmentIndex) => {
        const cells: Cell[] = components.map((_, componentIndex) => {
            const inputCell = source.cells[componentIndex];
            if (!inputCell) throw new Error("Missing cell in normalized input");
            const raw = inputCell.value;
            const blank = raw === null || raw === undefined;
            const valid = typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
            const value = valid ? raw : null;
            if (blank) blanks++;
            else if (!valid) invalid++;
            const h = inputCell.highlight;
            const validHighlight = h === null || h === undefined ||
                (typeof h === "number" && Number.isFinite(h) && h >= 0 && h <= (value ?? 0));
            if (!validHighlight) invalidHighlights++;
            return {
                identity: inputCell.identity, segmentIndex, componentIndex, value,
                status: blank ? "blank" : valid ? "value" : "invalid",
                highlight: validHighlight && typeof h === "number" ? h : null,
                format: inputCell.format, segmentShare: null, overallShare: null, y: 0, height: 0
            };
        });
        return { key: source.key, label: source.label, identity: source.identity,
            total: sum(cells.map(cell => cell.value ?? 0)), x: 0, width: 0, cells };
    });
    const total = sum(segments.map(segment => segment.total));
    if (!segments.length || !components.length) diagnostics.push({ code: "empty" });
    if (invalid) diagnostics.push({ code: "invalid", count: invalid });
    if (blanks) diagnostics.push({ code: "blank", count: blanks });
    if (invalidHighlights) diagnostics.push({ code: "highlight", count: invalidHighlights });
    let rangeError = !Number.isFinite(total) || segments.some(segment => !Number.isFinite(segment.total));
    let drawable = segments.length > 0 && components.length > 0 && input.additiveConfirmed &&
        !input.percentageMeasure && input.identityValid && !invalid && !rangeError && total > 0;
    if (drawable) {
        let x = 0;
        for (const segment of segments) {
            segment.x = x;
            segment.width = segment.total / total;
            x += segment.width;
            let height = 0;
            for (const cell of segment.cells) {
                cell.overallShare = cell.value === null ? null : cell.value / total;
                cell.segmentShare = cell.value === null || segment.total === 0 ? null : cell.value / segment.total;
                cell.height = cell.segmentShare ?? 0;
                cell.y = 1 - height - cell.height;
                const previousHeight = height;
                height += cell.height;
                if ((cell.value ?? 0) > 0 && (!cell.height || !cell.overallShare || height === previousHeight)) rangeError = true;
            }
            if (segment.total > 0 && (!segment.width || x === segment.x)) rangeError = true;
        }
    }
    if (rangeError) {
        drawable = false;
        diagnostics.push({ code: "range" });
    } else if (!invalid && total === 0 && segments.length && components.length) {
        diagnostics.push({ code: segments.some(segment => segment.cells.some(cell => cell.status === "value")) ? "zero" : "empty" });
    }
    if (!drawable) {
        for (const segment of segments) {
            segment.x = segment.width = 0;
            for (const cell of segment.cells) {
                cell.y = cell.height = 0;
                cell.segmentShare = cell.overallShare = null;
            }
        }
    }
    return { segments, components, total, drawable, partial, hasHighlights: input.hasHighlights && !invalidHighlights, diagnostics };
}

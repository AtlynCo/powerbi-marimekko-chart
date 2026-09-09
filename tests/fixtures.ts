import type powerbi from "powerbi-visuals-api";
import type { DataHost } from "../src/data";
import type { Identity, ModelInput } from "../src/model";

export type Matrix = readonly (readonly unknown[])[];
export type ScopeIdentity = powerbi.visuals.CustomVisualOpaqueIdentity & { key: string };
export type SelectionCall =
    | { method: "withCategory"; column: powerbi.DataViewCategoryColumn; index: number }
    | { method: "withSeries"; column: powerbi.DataViewValueColumns; group: powerbi.DataViewValueColumn | powerbi.DataViewValueColumnGroup }
    | { method: "withMeasure"; measure: string };

export class TestSelectionId implements Identity {
    constructor(readonly parts: readonly string[], private readonly valid = true) {}
    equals(other: Identity): boolean { return this.getKey() === other.getKey(); }
    includes(other: Identity): boolean {
        return other instanceof TestSelectionId && this.parts.every(part => other.parts.includes(part));
    }
    getKey(): string { return JSON.stringify(this.parts); }
    getSelector(): powerbi.data.Selector { return { parts: this.parts }; }
    getSelectorsByColumn(): powerbi.data.SelectorsByColumn { return { parts: this.parts }; }
    hasIdentity(): boolean { return this.valid && this.parts.length > 0; }
}

export class RecordingSelectionBuilder implements powerbi.visuals.ISelectionIdBuilder {
    readonly calls: SelectionCall[] = [];
    private readonly parts: string[] = [];
    private valid = true;

    constructor(private readonly issue: (parts: readonly string[], valid: boolean) => Identity) {}

    withCategory(column: powerbi.DataViewCategoryColumn, index: number): this {
        this.calls.push({ method: "withCategory", column, index });
        const identity = column.identity?.[index] as ScopeIdentity | undefined;
        this.valid &&= !!identity;
        this.parts.push(`category:${identity?.key ?? "missing"}`);
        return this;
    }
    withSeries(column: powerbi.DataViewValueColumns, group: powerbi.DataViewValueColumn | powerbi.DataViewValueColumnGroup): this {
        this.calls.push({ method: "withSeries", column, group });
        const identity = group.identity as ScopeIdentity | undefined;
        this.valid &&= !!identity;
        this.parts.push(`series:${identity?.key ?? "missing"}`);
        return this;
    }
    withMeasure(measure: string): this {
        this.calls.push({ method: "withMeasure", measure });
        this.parts.push(`measure:${measure}`);
        return this;
    }
    withMatrixNode(): this { throw new Error("Unexpected matrix binding"); }
    withTable(): this { throw new Error("Unexpected table binding"); }
    createSelectionId(): Identity { return this.issue([...this.parts], this.valid); }
}

export interface RecordingDataHost extends DataHost {
    builders: RecordingSelectionBuilder[];
    identities: Identity[];
}

export function makeDataHost(
    locale = "en-US",
    identityFactory = (parts: readonly string[], valid: boolean): Identity => new TestSelectionId(parts, valid)
): RecordingDataHost {
    const builders: RecordingSelectionBuilder[] = [];
    const identities: Identity[] = [];
    return {
        locale, builders, identities,
        createSelectionIdBuilder: () => {
            const builder = new RecordingSelectionBuilder((parts, valid) => {
                const identity = identityFactory(parts, valid);
                identities.push(identity);
                return identity;
            });
            builders.push(builder);
            return builder;
        }
    };
}

export interface DataViewOptions {
    segmentLabels?: (powerbi.PrimitiveValue | null | undefined)[];
    componentLabels?: (powerbi.PrimitiveValue | null | undefined)[];
    segmentKeys?: string[];
    componentKeys?: string[];
    componentCount?: number;
    highlights?: Matrix;
    measureFormat?: string;
    segmentFormat?: string;
    componentFormat?: string;
    dynamicFormats?: readonly (readonly (string | undefined)[])[];
    partial?: boolean;
    objects?: powerbi.DataViewObjects;
}

export interface DataViewFixture {
    view: powerbi.DataView;
    category: powerbi.DataViewCategoryColumn;
    values: powerbi.DataViewValueColumns;
    groups: powerbi.DataViewValueColumnGroup[];
}

export function makeDataView(matrix: Matrix = [[30, 10], [15, 45]], options: DataViewOptions = {}): DataViewFixture {
    const componentCount = options.componentCount ?? options.componentLabels?.length ?? matrix[0]?.length ?? 2;
    const category: powerbi.DataViewCategoryColumn = {
        source: { displayName: "Segment", queryName: "Dim.Segment", roles: { segment: true }, format: options.segmentFormat },
        values: matrix.map((_, index) => options.segmentLabels ? options.segmentLabels[index] : `Segment ${index}`) as powerbi.PrimitiveValue[],
        identity: matrix.map((_, index): ScopeIdentity => ({ key: options.segmentKeys?.[index] ?? `segment-${index}` }))
    };
    const groups: powerbi.DataViewValueColumnGroup[] = Array.from({ length: componentCount }, (_, componentIndex) => {
        const identity: ScopeIdentity = { key: options.componentKeys?.[componentIndex] ?? `component-${componentIndex}` };
        const column: powerbi.DataViewValueColumn = {
            source: {
                displayName: "Amount", queryName: "Fact.Amount", roles: { value: true }, isMeasure: true,
                format: options.measureFormat
            },
            values: matrix.map(row => row[componentIndex] as powerbi.PrimitiveValue),
            identity
        };
        if (options.highlights) column.highlights = options.highlights.map(row => row[componentIndex] as powerbi.PrimitiveValue);
        if (options.dynamicFormats) column.objects = options.dynamicFormats.map((row): powerbi.DataViewObjects => {
            const formatString = row[componentIndex];
            return { general: formatString === undefined ? {} : { formatString } };
        });
        return {
            name: (options.componentLabels ? options.componentLabels[componentIndex] : `Component ${componentIndex}`) as powerbi.PrimitiveValue,
            identity, values: [column]
        };
    });
    const values: powerbi.DataViewValueColumns = Object.assign(groups.flatMap(group => group.values), {
        grouped: () => groups,
        source: {
            displayName: "Component", queryName: "Dim.Component", roles: { component: true },
            format: options.componentFormat
        }
    });
    const view: powerbi.DataView = {
        metadata: { columns: [category.source, values.source!, ...values.map(column => column.source)], objects: options.objects },
        categorical: { categories: [category], values }
    };
    if (options.partial) view.metadata.segment = {};
    return { view, category, values, groups };
}

export function makeModelInput(matrix: Matrix = [[30, 10], [15, 45]], overrides: Partial<ModelInput> = {}): ModelInput {
    const components = Array.from({ length: matrix[0]?.length ?? 2 }, (_, index) => ({
        key: `component-${index}`, label: `Component ${index}`, identity: new TestSelectionId([`series:component-${index}`])
    }));
    return {
        components,
        segments: matrix.map((row, segmentIndex) => ({
            key: `segment-${segmentIndex}`, label: `Segment ${segmentIndex}`,
            identity: new TestSelectionId([`category:segment-${segmentIndex}`]),
            cells: row.map((value, componentIndex) => ({
                value, identity: new TestSelectionId([`category:segment-${segmentIndex}`, `series:component-${componentIndex}`, "measure:Fact.Amount"])
            }))
        })),
        additiveConfirmed: true, percentageMeasure: false, identityValid: true,
        partial: false, reduced: false, hasHighlights: false, ...overrides
    };
}

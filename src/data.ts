import type powerbi from "powerbi-visuals-api";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { buildModel, isPercentageFormat, LIMITS, type ChartModel, type InputSegment } from "./model";

export type DataHost = Pick<powerbi.extensibility.visual.IVisualHost, "createSelectionIdBuilder" | "locale">;

export function convert(view: powerbi.DataView | undefined, host: DataHost, additiveConfirmed: boolean, blankLabel: string): ChartModel {
    const category = view?.categorical?.categories?.find(column => column.source.roles?.segment);
    const values = view?.categorical?.values;
    const groups = values?.grouped() ?? [];
    const empty = () => buildModel({
        segments: [], components: [], hasHighlights: false, partial: !!view?.metadata.segment, reduced: false,
        additiveConfirmed, percentageMeasure: false, identityValid: true
    });
    if (!category || !values || !values.source?.roles?.component || !groups.length ||
        groups.some(group => group.values.length !== 1 || !group.values[0]?.source.roles?.value)) {
        const model = empty();
        model.diagnostics = [{ code: "binding" }];
        return model;
    }
    const chosen = groups.slice(0, LIMITS.components);
    let identityValid = true;
    const components = chosen.map(group => {
        const identity = host.createSelectionIdBuilder().withSeries(values, group).createSelectionId();
        if (!group.identity || !identity.hasIdentity()) identityValid = false;
        return { key: identity.getKey(), identity,
            label: group.name == null ? blankLabel :
                valueFormatter.format(group.name, values.source?.format, false, host.locale).slice(0, 2048) };
    });
    const segmentLimit = Math.min(LIMITS.segments, Math.floor(LIMITS.cells / chosen.length));
    let percentageMeasure = chosen.some(group => isPercentageFormat(group.values[0]?.source.format));
    const segments: InputSegment[] = category.values.slice(0, segmentLimit).map((name, index) => {
        const identity = host.createSelectionIdBuilder().withCategory(category, index).createSelectionId();
        if (!category.identity?.[index] || !identity.hasIdentity()) identityValid = false;
        return {
            key: identity.getKey(), identity,
            label: name == null ? blankLabel : valueFormatter.format(name, category.source.format, false, host.locale).slice(0, 2048),
            cells: chosen.map(group => {
                const column = group.values[0];
                if (!column) throw new Error("Missing value column");
                const measure = column.source.queryName;
                if (!measure) identityValid = false;
                const builder = host.createSelectionIdBuilder().withCategory(category, index).withSeries(values, group);
                if (measure) builder.withMeasure(measure);
                const cellIdentity = builder.createSelectionId();
                if (!cellIdentity.hasIdentity()) identityValid = false;
                const dynamicFormat = column.objects?.[index]?.general?.formatString;
                const format = typeof dynamicFormat === "string" ? dynamicFormat : column.source.format;
                if (isPercentageFormat(format)) percentageMeasure = true;
                return { value: column.values[index], highlight: column.highlights?.[index], identity: cellIdentity, format };
            })
        };
    });
    if (new Set(segments.map(segment => segment.key)).size !== segments.length ||
        new Set(components.map(component => component.key)).size !== components.length) identityValid = false;
    return buildModel({
        segments, components, hasHighlights: chosen.some(group => group.values[0]?.highlights !== undefined),
        partial: !!view?.metadata.segment, reduced: groups.length > LIMITS.components || category.values.length > segmentLimit,
        additiveConfirmed, percentageMeasure, identityValid
    });
}

import type powerbi from "powerbi-visuals-api";
import { dictionary, type TextKey } from "./i18n";

export interface Settings {
    additiveConfirmed: boolean;
    showLabels: boolean;
    labelContent: "segmentShare" | "raw" | "overallShare";
    minLabelWidth: number;
    fontSize: number;
    showTable: boolean;
    direction: "auto" | "ltr" | "rtl";
}
export const DEFAULTS: Settings = {
    additiveConfirmed: false, showLabels: true, labelContent: "segmentShare", minLabelWidth: 48,
    fontSize: 12, showTable: false, direction: "auto"
};
export function readSettings(objects?: powerbi.DataViewObjects): Settings {
    const appearance = objects?.appearance;
    const numeric = (name: string, fallback: number, min: number, max: number) => {
        const value = appearance?.[name];
        return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    };
    const labels = appearance?.labelContent;
    const direction = appearance?.direction;
    return {
        additiveConfirmed: objects?.dataContract?.additiveConfirmed === true,
        showLabels: typeof appearance?.showLabels === "boolean" ? appearance.showLabels : DEFAULTS.showLabels,
        labelContent: typeof labels === "string" && (labels === "raw" || labels === "overallShare") ? labels : "segmentShare",
        minLabelWidth: numeric("minLabelWidth", 48, 16, 300), fontSize: numeric("fontSize", 12, 10, 24),
        showTable: typeof appearance?.showTable === "boolean" ? appearance.showTable : DEFAULTS.showTable,
        direction: typeof direction === "string" && (direction === "ltr" || direction === "rtl") ? direction : "auto"
    };
}
export function formattingModel(settings: Settings, locale: string): powerbi.visuals.FormattingModel {
    const text = dictionary(locale);
    const toggle = (objectName: string, propertyName: keyof Settings & TextKey): powerbi.visuals.FormattingSlice => ({
        uid: `${objectName}-${propertyName}`, displayName: text[propertyName],
        control: { type: "ToggleSwitch", properties: {
            descriptor: { objectName, propertyName }, value: settings[propertyName] === true
        } }
    });
    const numeric = (propertyName: "minLabelWidth" | "fontSize", min: number, max: number): powerbi.visuals.FormattingSlice => ({
        uid: `appearance-${propertyName}`, displayName: text[propertyName],
        control: { type: "NumUpDown", properties: {
            descriptor: { objectName: "appearance", propertyName }, value: settings[propertyName],
            options: { minValue: { type: 0, value: min }, maxValue: { type: 1, value: max } }
        } }
    });
    const dropdown = (propertyName: "labelContent" | "direction", keys: TextKey[]): powerbi.visuals.FormattingSlice => ({
        uid: `appearance-${propertyName}`, displayName: text[propertyName],
        control: { type: "Dropdown", properties: {
            descriptor: { objectName: "appearance", propertyName }, value: settings[propertyName],
            mergeValues: keys.map(key => ({ value: key, displayName: text[key] }))
        } }
    });
    const cards: { name: "dataContract" | "appearance"; properties: (keyof Settings)[]; slices: powerbi.visuals.FormattingSlice[] }[] = [
        { name: "dataContract", properties: ["additiveConfirmed"], slices: [toggle("dataContract", "additiveConfirmed")] },
        { name: "appearance", properties: ["showLabels", "labelContent", "minLabelWidth", "fontSize", "showTable", "direction"],
            slices: [toggle("appearance", "showLabels"), dropdown("labelContent", ["segmentShare", "raw", "overallShare"]),
                numeric("minLabelWidth", 16, 300), numeric("fontSize", 10, 24), toggle("appearance", "showTable"),
                dropdown("direction", ["auto", "ltr", "rtl"])] }
    ];
    return { cards: cards.map(card => ({
        uid: card.name, displayName: text[card.name],
        groups: [{ uid: `${card.name}-group`, displayName: text[card.name], slices: card.slices }],
        revertToDefaultDescriptors: card.properties.map(propertyName => ({ objectName: card.name, propertyName }))
    })) };
}

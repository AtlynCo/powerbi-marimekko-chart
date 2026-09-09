import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type powerbi from "powerbi-visuals-api";
import { DEFAULTS, formattingModel, readSettings, type Settings } from "../src/settings";

const objects = (appearance: Record<string, unknown>, dataContract?: Record<string, unknown>): powerbi.DataViewObjects =>
    ({ appearance, dataContract }) as powerbi.DataViewObjects;

function cards(model: powerbi.visuals.FormattingModel): powerbi.visuals.FormattingCard[] {
    return model.cards.map(card => {
        assert.ok("groups" in card);
        return card;
    });
}

function slices(model: powerbi.visuals.FormattingModel): powerbi.visuals.FormattingSlice[] {
    return cards(model).flatMap(card => card.groups.flatMap(group => {
        assert.ok("uid" in group);
        return (group.slices ?? []).map(slice => {
            assert.ok("control" in slice);
            return slice;
        });
    }));
}

describe("settings validation", () => {
    it("uses conservative defaults for absent, empty, and unrelated metadata", () => {
        assert.deepEqual(DEFAULTS, {
            additiveConfirmed: false, showLabels: true, labelContent: "segmentShare",
            minLabelWidth: 48, fontSize: 12, showTable: false, direction: "auto"
        });
        for (const input of [undefined, {}, { unrelated: { value: "anything" } }, objects({})]) {
            assert.deepEqual(readSettings(input), DEFAULTS);
        }
    });

    it("returns fresh settings without mutating metadata or exported defaults", () => {
        const input = objects({ showLabels: false, fontSize: 18 }, { additiveConfirmed: true });
        const before = JSON.stringify(input);
        const defaultsBefore = { ...DEFAULTS };
        const first = readSettings(input);
        const second = readSettings(input);
        assert.notStrictEqual(first, second);
        first.fontSize = 24;
        assert.equal(second.fontSize, 18);
        assert.equal(JSON.stringify(input), before);
        assert.deepEqual(DEFAULTS, defaultsBefore);
    });

    it("reads every supported persisted setting", () => {
        const expected: Settings = {
            additiveConfirmed: true, showLabels: false, labelContent: "raw", minLabelWidth: 75,
            fontSize: 18, showTable: true, direction: "rtl"
        };
        assert.deepEqual(readSettings(objects({
            showLabels: false, labelContent: "raw", minLabelWidth: 75, fontSize: 18, showTable: true, direction: "rtl"
        }, { additiveConfirmed: true })), expected);
    });

    it("requires the exact boolean true in the dataContract object before confirming additivity", () => {
        assert.equal(readSettings(objects({}, { additiveConfirmed: true })).additiveConfirmed, true);
        for (const value of [false, undefined, null, 0, 1, "true", "false", {}, [], NaN]) {
            assert.equal(readSettings(objects({}, { additiveConfirmed: value })).additiveConfirmed, false);
        }
        assert.equal(readSettings(objects({ additiveConfirmed: true })).additiveConfirmed, false);
    });

    for (const name of ["showLabels", "showTable"] as const) {
        it(`accepts only booleans for ${name}`, () => {
            for (const value of [true, false]) assert.equal(readSettings(objects({ [name]: value }))[name], value);
            for (const value of [undefined, null, 0, 1, "true", "false", {}, []]) {
                assert.equal(readSettings(objects({ [name]: value }))[name], DEFAULTS[name]);
            }
        });
    }

    for (const [name, min, max, fallback] of [
        ["minLabelWidth", 16, 300, 48], ["fontSize", 10, 24, 12]
    ] as const) {
        it(`clamps finite ${name} to the supported inclusive interval`, () => {
            for (const [value, expected] of [
                [-100, min], [0, min], [min - 0.5, min], [min, min],
                [min + 0.5, min + 0.5], [max, max], [max + 1, max], [Number.MAX_VALUE, max]
            ]) {
                assert.equal(readSettings(objects({ [name]: value }))[name], expected);
            }
        });
        it(`does not coerce malformed or nonfinite ${name}`, () => {
            for (const value of [undefined, null, NaN, Infinity, -Infinity, "20", "", false, {}, [20]]) {
                assert.equal(readSettings(objects({ [name]: value }))[name], fallback);
            }
        });
    }

    it("allowlists label content without accepting arbitrary strings or objects", () => {
        for (const value of ["raw", "segmentShare", "overallShare"] as const) {
            assert.equal(readSettings(objects({ labelContent: value })).labelContent, value);
        }
        for (const value of [undefined, null, 0, true, "", "Raw", "width", "<script>", {}, ["raw"]]) {
            assert.equal(readSettings(objects({ labelContent: value })).labelContent, "segmentShare");
        }
    });

    it("allowlists direction without accepting arbitrary strings or objects", () => {
        for (const value of ["auto", "ltr", "rtl"] as const) {
            assert.equal(readSettings(objects({ direction: value })).direction, value);
        }
        for (const value of [undefined, null, 1, true, "", "RTL", "right", {}, ["rtl"]]) {
            assert.equal(readSettings(objects({ direction: value })).direction, "auto");
        }
    });
});

describe("Power BI formatting model", () => {
    it("exposes each setting exactly once with stable UIDs and matching reset descriptors", () => {
        const model = formattingModel(DEFAULTS, "en-US");
        const formattedCards = cards(model);
        assert.deepEqual(formattedCards.map(card => card.uid), ["dataContract", "appearance"]);
        const allUids: string[] = [];
        const properties: string[] = [];
        for (const card of formattedCards) {
            allUids.push(card.uid);
            const descriptors: powerbi.visuals.FormattingDescriptor[] = [];
            for (const group of card.groups) {
                assert.ok("uid" in group);
                allUids.push(group.uid);
                for (const slice of group.slices ?? []) {
                    assert.ok("control" in slice);
                    allUids.push(slice.uid);
                    assert.ok(slice.displayName);
                    const control = slice.control;
                    assert.ok(control.type === "ToggleSwitch" || control.type === "NumUpDown" || control.type === "Dropdown");
                    const descriptor = control.properties.descriptor;
                    assert.equal(descriptor.objectName, card.uid);
                    assert.equal(slice.uid, `${descriptor.objectName}-${descriptor.propertyName}`);
                    descriptors.push(descriptor);
                    properties.push(descriptor.propertyName);
                }
            }
            assert.deepEqual(card.revertToDefaultDescriptors, descriptors);
        }
        assert.equal(new Set(allUids).size, allUids.length);
        assert.deepEqual(properties.sort(), Object.keys(DEFAULTS).sort());
        assert.deepEqual(slices(model).map(slice => slice.uid), slices(formattingModel(DEFAULTS, "fr-FR")).map(slice => slice.uid));
    });

    it("binds controls to the current settings rather than their defaults", () => {
        const settings: Settings = {
            additiveConfirmed: true, showLabels: false, labelContent: "overallShare",
            minLabelWidth: 120, fontSize: 20, showTable: true, direction: "rtl"
        };
        const before = { ...settings };
        for (const slice of slices(formattingModel(settings, "en-US"))) {
            const control = slice.control;
            assert.ok(control.type === "ToggleSwitch" || control.type === "NumUpDown" || control.type === "Dropdown");
            const property = control.properties.descriptor.propertyName as keyof Settings;
            assert.equal(control.properties.value, settings[property]);
        }
        assert.deepEqual(settings, before);
    });

    it("keeps numeric editor boundaries consistent with persisted-setting validation", () => {
        const numeric = slices(formattingModel(DEFAULTS, "en-US")).filter(slice => slice.control.type === "NumUpDown");
        assert.equal(numeric.length, 2);
        for (const slice of numeric) {
            assert.ok(slice.control.type === "NumUpDown");
            const properties = slice.control.properties;
            const property = properties.descriptor.propertyName;
            const [min, max] = property === "minLabelWidth" ? [16, 300] : [10, 24];
            assert.deepEqual(properties.options, {
                minValue: { type: 0, value: min }, maxValue: { type: 1, value: max }
            });
            assert.equal(readSettings(objects({ [property]: -100 }))[property as keyof Settings], min);
            assert.equal(readSettings(objects({ [property]: 999 }))[property as keyof Settings], max);
        }
    });

    it("publishes exactly the accepted dropdown values with localized display labels", () => {
        const model = formattingModel(DEFAULTS, "fr-FR");
        const dropdowns = slices(model).filter(slice => slice.control.type === "Dropdown");
        assert.equal(dropdowns.length, 2);
        for (const slice of dropdowns) {
            assert.ok(slice.control.type === "Dropdown");
            const properties = slice.control.properties;
            assert.ok("mergeValues" in properties);
            const expected = properties.descriptor.propertyName === "labelContent" ?
                ["segmentShare", "raw", "overallShare"] : ["auto", "ltr", "rtl"];
            assert.deepEqual(properties.mergeValues?.map(item => item.value), expected);
            assert.ok(properties.mergeValues?.every(item => !!item.displayName));
        }
        assert.equal(cards(model)[0]!.displayName, "Contrat des donnees");
        assert.equal(slices(model).find(slice => slice.uid === "appearance-showLabels")!.displayName, "Afficher les etiquettes");
    });

    it("uses English fallback for unknown locales and French case-insensitive regional locales", () => {
        assert.deepEqual(formattingModel(DEFAULTS, "zz-ZZ"), formattingModel(DEFAULTS, "en-US"));
        assert.deepEqual(formattingModel(DEFAULTS, "FR-ca"), formattingModel(DEFAULTS, "fr-FR"));
    });
});

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Original product artwork at both submission sizes; rendered directly, not upscaled from a screenshot.
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
    const data = Buffer.concat([Buffer.from(type), bytes]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(bytes.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(data));
    return Buffer.concat([size, data, crc]);
}
for (const size of [20, 300]) {
    const stride = size * 4 + 1;
    const rows = Buffer.alloc(size * stride);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = x * 20 / size;
            const py = y * 20 / size;
            let rgb = [255, 255, 255];
            if (px >= 2 && px < 18 && py >= 2 && py < 18 &&
                !(px >= 10 && px < 11) && !(px >= 15 && px < 16)) {
                rgb = py < (px < 10 ? 8 : px < 15 ? 13 : 6) ? [22, 101, 167] : [38, 130, 115];
            }
            const offset = y * stride + 1 + x * 4;
            rows.set([...rgb, 255], offset);
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    writeFileSync(new URL(`../assets/${size === 20 ? "icon" : "icon-300"}.png`, import.meta.url), Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
        chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))
    ]));
}

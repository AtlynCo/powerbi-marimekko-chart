import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Original 20px product icon. PNG generation is deterministic and has no image-tool dependency.
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
const rows = Buffer.alloc(20 * 81);
for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
        let rgb = [255, 255, 255];
        if (x >= 2 && x < 18 && y >= 2 && y < 18 && x !== 10 && x !== 15) {
            rgb = y < (x < 10 ? 8 : x < 15 ? 13 : 6) ? [22, 101, 167] : [38, 130, 115];
        }
        const offset = y * 81 + 1 + x * 4;
        rows.set([...rgb, 255], offset);
    }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(20, 0);
header.writeUInt32BE(20, 4);
header[8] = 8;
header[9] = 6;
writeFileSync(new URL("../assets/icon.png", import.meta.url), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))
]));

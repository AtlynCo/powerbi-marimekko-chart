import fs from "node:fs";
import path from "node:path";

const target = path.resolve("node_modules", "powerbi-visuals-webpack-plugin", "src", "localizationLoader.js");
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, "utf8");
  if (!content.includes("const fn = new Function")) {
    const originalPattern = /const result = Object\.entries\(eval\((?:source|executable)\)\)\.filter\(/;
    if (originalPattern.test(content)) {
      content = content.replace(
        originalPattern,
        `const fn = new Function(
\t\tsource.replace(/^\\s*export\\s+const\\s+locales\\s*=/m, "let locales =") +
\t\t\t"\\nreturn locales;",
\t);
\tconst locales = fn();
\tconst result = Object.entries(locales).filter(`
      );
      content = content.replace(
        /const executable = source\.replace\(.*?;\r?\n/,
        ""
      );
      fs.writeFileSync(target, content, "utf8");
      console.log("Patched powerbi-visuals-webpack-plugin localizationLoader.js successfully.");
    }
  }
}

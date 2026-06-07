// Generates icon.png (1024x1024) from icon.svg using sharp
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

async function main() {
  let sharp;
  try {
    const req = createRequire(import.meta.url);
    sharp = req("sharp");
  } catch {
    console.log("Installing sharp...");
    const { execSync } = await import("child_process");
    execSync("npm install sharp --save-dev", { cwd: join(__dir, ".."), stdio: "inherit" });
    const req = createRequire(import.meta.url);
    sharp = req("sharp");
  }

  const svgPath = join(__dir, "icon.svg");
  const outPath = join(__dir, "icon-1024.png");
  const svg = readFileSync(svgPath);

  await sharp(svg)
    .resize(1024, 1024)
    .png()
    .toFile(outPath);

  console.log(`Written: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

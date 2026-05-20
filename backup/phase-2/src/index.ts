import { ExcelHandler } from "./excelHandler.js";
import { DiceService } from "./diceService.js";
import { MonsterService } from "./monsterService.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processDiceForCandidate(baseDir: string, excelHandler: ExcelHandler, creds: any) {
  const diceService = new DiceService(baseDir);
  try {
    await diceService.init();
    await diceService.login(creds);
    await diceService.updateResume(creds);

    await excelHandler.writeResult({
      email: creds.diceEmail,
      status: "SUCCESS",
      timestamp: new Date().toLocaleString(),
      message: "[Dice] Resume updated successfully"
    });
  } catch (err: any) {
    if (err.message === "account not exists or deleted") {
       console.log("account not exists or deleted");
    } else {
       console.error(`❌ Dice Error: ${err?.message || err}`);
    }
    await excelHandler.writeResult({
      email: creds.diceEmail,
      status: "FAILED",
      timestamp: new Date().toLocaleString(),
      message: `[Dice] ${err?.message || String(err)}`
    });
  } finally {
    await diceService.close().catch(() => {});
    console.log("close browser");
  }
}

async function processMonsterForCandidate(baseDir: string, excelHandler: ExcelHandler, creds: any) {
  const monsterService = new MonsterService(baseDir, { headless: false });
  try {
    await monsterService.init();
    await monsterService.login(creds);
    await monsterService.updateResume(creds);

    await excelHandler.writeResult({
      email: creds.monsterEmail,
      status: "SUCCESS",
      timestamp: new Date().toLocaleString(),
      message: "[Monster] Resume updated successfully"
    });
  } catch (err: any) {
    if (err.message === "account not exists") {
       console.log("account not exists");
    } else if (err.message.includes("Bot detection")) {
       console.log(`account not exists (Reason: ${err.message})`);
    } else {
       console.error(`❌ Monster Error: ${err?.message || err}`);
    }
    await excelHandler.writeResult({
      email: creds.monsterEmail,
      status: "FAILED",
      timestamp: new Date().toLocaleString(),
      message: `[Monster] ${err?.message || String(err)}`
    });
  } finally {
    await monsterService.close().catch(() => {});
  }
}

async function main() {
  const baseDir = path.join(__dirname, "..");
  const excelHandler = new ExcelHandler(baseDir);

  try {
    const credentials = await excelHandler.readCredentials();

    for (const creds of credentials) {
      // Process Dice
      if (creds.diceEmail && creds.dicePassword) {
        await processDiceForCandidate(baseDir, excelHandler, creds);
      }

      // Process Monster
      if (creds.monsterEmail && creds.monsterPassword) {
        await processMonsterForCandidate(baseDir, excelHandler, creds);
      }
    }
  } catch (err: any) {
    console.error("Fatal Error:", err?.message || err);
  }
}

main();


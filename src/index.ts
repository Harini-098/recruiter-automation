import { ExcelHandler } from "./excelHandler.js";
import { DiceService } from "./diceService.js";
import { MonsterService } from "./monsterService.js";
import { IndeedService } from "./indeedService.js";
import { Logger } from "./logger.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processDiceForCandidate(baseDir: string, excelHandler: ExcelHandler, logger: Logger, creds: any) {
  const diceService = new DiceService(baseDir, logger);
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
    logger.error("Dice", `Error: ${err.message}`);
    await excelHandler.writeResult({
      email: creds.diceEmail,
      status: "FAILED",
      timestamp: new Date().toLocaleString(),
      message: `[Dice] ${err?.message || String(err)}`
    });
  } finally {
    await diceService.close();
  }
}

async function processMonsterForCandidate(baseDir: string, excelHandler: ExcelHandler, logger: Logger, creds: any) {
  const monsterService = new MonsterService(baseDir, logger, { headless: false });
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
    logger.error("Monster", `Error: ${err.message}`);
    await excelHandler.writeResult({
      email: creds.monsterEmail,
      status: "FAILED",
      timestamp: new Date().toLocaleString(),
      message: `[Monster] ${err?.message || String(err)}`
    });
  } finally {
    await monsterService.close();
  }
}

async function processIndeedForCandidate(baseDir: string, excelHandler: ExcelHandler, logger: Logger, creds: any) {
  const indeedService = new IndeedService(baseDir, logger, { headless: false });
  try {
    await indeedService.init(creds.indeedEmail);
    await indeedService.login(creds);
    await indeedService.updateResume(creds);

    await excelHandler.writeResult({
      email: creds.indeedEmail,
      status: "SUCCESS",
      timestamp: new Date().toLocaleString(),
      message: "[Indeed] Resume updated successfully"
    });
  } catch (err: any) {
    logger.error("Indeed", `Error: ${err.message}`);
    await excelHandler.writeResult({
      email: creds.indeedEmail,
      status: "FAILED",
      timestamp: new Date().toLocaleString(),
      message: `[Indeed] ${err?.message || String(err)}`
    });
  } finally {
    await indeedService.close();
  }
}

async function main() {
  const baseDir = path.join(__dirname, "..");
  const logger = new Logger(baseDir);
  const excelHandler = new ExcelHandler(baseDir);

  try {
    console.log("\n========================================");
    console.log("   RECRUITER AUTOMATION ENGINE v1.0   ");
    console.log("========================================\n");

    logger.info("Main", "Starting automation process");
    const credentials = await excelHandler.readCredentials();
    logger.info("Main", `Loaded ${credentials.length} candidates from Excel`);

    let processedCount = 0;

    for (const creds of credentials) {
      processedCount++;
      console.log(`\n[${processedCount}/${credentials.length}] Processing: ${creds.name}`);
      logger.info("Main", `--- Candidate: ${creds.name} ---`);

      // Process Dice
      if (creds.diceEmail && creds.dicePassword) {
        await processDiceForCandidate(baseDir, excelHandler, logger, creds).catch(err => {
            logger.error("Main", `Dice unhandled error: ${err.message}`);
        });
      }

      // Process Monster
      if (creds.monsterEmail && creds.monsterPassword) {
        await processMonsterForCandidate(baseDir, excelHandler, logger, creds).catch(err => {
            logger.error("Main", `Monster unhandled error: ${err.message}`);
        });
      }

      // Process Indeed
      if (creds.indeedEmail && creds.indeedPassword) {
        await processIndeedForCandidate(baseDir, excelHandler, logger, creds).catch(err => {
            logger.error("Main", `Indeed unhandled error: ${err.message}`);
        });
      }
    }
    
    console.log("\n========================================");
    console.log("   ALL TASKS COMPLETED SUCCESSFULLY   ");
    console.log("========================================\n");
    logger.info("Main", "Automation process completed");
  } catch (err: any) {
    logger.error("Main", `Fatal Error: ${err?.message || err}`);
    console.error(`\nFATAL ERROR: ${err?.message || err}`);
  }
}

main();

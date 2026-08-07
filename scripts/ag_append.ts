import * as fs from "fs";

const REPORT_FILE = "C:\\Users\\naoma\\.gemini\\antigravity-ide\\brain\\443473db-f9b2-4dda-aa4d-5b2b73cfdde7\\antigravity_report.md";
const contentToAppend = fs.readFileSync(process.argv[2], "utf-8");
fs.appendFileSync(REPORT_FILE, contentToAppend + "\n", "utf-8");
console.log("Appended to " + REPORT_FILE);

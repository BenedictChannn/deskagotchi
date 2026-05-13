import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

/**
 * Launch a local browser for static QA pages.
 *
 * @param {string} purpose - Human-readable QA scenario used in error text.
 * @returns {Promise<import("playwright").Browser>} Headless browser instance.
 */
export async function launchQaBrowser(purpose) {
  const executablePath = findBrowserExecutable();
  try {
    return await chromium.launch({
      executablePath,
      headless: true
    });
  } catch (error) {
    if (executablePath !== undefined) {
      throw error;
    }
    throw new Error(
      `Could not launch Playwright Chromium. Install Playwright browsers or Chrome/Edge for ${purpose}.`,
      { cause: error }
    );
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter((candidate) => candidate !== undefined);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

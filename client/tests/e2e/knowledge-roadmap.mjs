// Keep the existing Firefox command stable while sharing the maintained
// production-browser journey with Edge/Playwright.
process.argv.push("--browser=firefox");
await import("./core-loop.playwright.mjs");

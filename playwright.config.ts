import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',timeout:30000,fullyParallel:false,workers:1,
 use:{headless:true,launchOptions:{executablePath:process.env.CHROME_PATH||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)},screenshot:'only-on-failure',trace:'retain-on-failure'},
 reporter:[['list'],['json',{outputFile:process.env.MERCURY_REPORT_PATH||'../../work/browser-results-v2.json'}]]
});

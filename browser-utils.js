import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import {fileTypeFromFile} from "file-type";
import {isFileAnImage} from "./utils.js";

let browser;
let page;

export async function initBrowser() {
    browser = await puppeteer.launch({
        headless: false,
    });
    page = await browser.newPage();
}

export async function downloadImage(url, local_file) {
    const viewSource = await page.goto(url, { waitUntil: 'networkidle2' });
    fs.writeFileSync(local_file, await viewSource.buffer());

    // verify that the file is an PNG image
    const isImage = await isFileAnImage(local_file);

    if(!isImage) {
        throw new Error(`File ${local_file} is not an image`);
    }
}

export async function closeBrowser() {
    await browser.close();
}

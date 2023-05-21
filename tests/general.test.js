import {describe, expect, it} from "@jest/globals";
import {createGrid} from "../utils.js";
import fs from "fs";
import {PNG} from "pngjs";


describe('General tests', () => {
    it('should pass', () => {
        expect(true).toBe(true);
    });

    it('should create a 2x2 grid out of 4 image buffers', async () => {
        let imageBuffers = [
            fs.readFileSync("tests/1.png"),
            fs.readFileSync("tests/2.png"),
            fs.readFileSync("tests/3.png"),
            fs.readFileSync("tests/4.png"),
        ];

        const newGrid = await createGrid(imageBuffers);

        // parse this newGrid using pngjs and verify that its width 1280 and height 960
        const parsedGrid = PNG.sync.read(newGrid);
        expect(parsedGrid.width).toBe(1280);
        expect(parsedGrid.height).toBe(960);


    });
});

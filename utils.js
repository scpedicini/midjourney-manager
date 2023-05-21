import fs from "fs";
import {PNG} from "pngjs";
function createGrid(imageBuffers) {
    return new Promise((resolve, reject) => {
        let images = imageBuffers.map(buffer => PNG.sync.read(buffer));

        // Assuming all images are the same size
        let width = images[0].width;
        let height = images[0].height;

        let result = new PNG({ width: width * 2, height: height * 2 });

        for (let i = 0; i < images.length; i++) {
            let image = images[i];

            // Calculate position
            let x = (i % 2) * width;
            let y = Math.floor(i / 2) * height;

            for (let j = 0; j < width; j++) {
                for (let k = 0; k < height; k++) {
                    let idx = (width * j + k) << 2;

                    let dstIdx = (((y + k) * result.width + (x + j)) << 2);

                    // Copy pixel data
                    for (let l = 0; l < 4; l++) {
                        result.data[dstIdx + l] = image.data[idx + l];
                    }
                }
            }
        }

        const finalBuffer = PNG.sync.write(result);
        resolve(finalBuffer);
    });
}

export { createGrid }

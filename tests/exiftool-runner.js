import { exiftool }  from "exiftool-vendored";

// We're using the singleton here for convenience:

// And to verify everything is working:





(async () => {
    try {

        // const et = new ExifTool({
        //     taskTimeoutMillis: 5000,
        //     exiftoolPath: "/opt/homebrew/bin/exiftool"
        // })
        //
        // const version = await et.version();

        console.log("Launching using caxa!");

        // await extractExiftool();

        // console.log("Exiftool extracted!");


        const version = await exiftool.version();
        console.log(`We're running ExifTool v${version}`);
        // // const file = path.join(process.cwd(), "tests/1_exiftest.png");
        // // await exiftool.write("tests/2_exiftest.png", {
        // //     "Description": "This is a test image with exif/\\tool - here is an emoji: 🤖, here is some unicode: 你好 --v 4 --style 4b",
        // //     "Subject": "This is the subject",
        // //     "Author": "https://discord.com/channels/@me/1081059575136002170/1081063347715325982",
        // //     "AllDates": "2023-01-01 04:01:50.818059"
        // // })
        await exiftool.end();
    } catch (error) {
        console.log(`It looks like we can't find exiftool. Please make sure it's installed and available in your PATH.` );
        console.error(error);
    }

})();
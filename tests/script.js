import fs from "fs";
import terminalKitPackage from 'terminal-kit';

// import color from "ascii-art-ansi";
// // import art from "ascii-art";
// // const { Image } = art;
//
const { terminal: term  } = terminalKitPackage;
// color.is256 = true;

const sleep = (ms) =>  new Promise(resolve => setTimeout(resolve, ms));

(async () => {

    let imageBuffers = [
        fs.readFileSync("tests/1.png"),
        fs.readFileSync("tests/2.png"),
        fs.readFileSync("tests/3.png"),
        fs.readFileSync("tests/4.png"),
    ];

    // term.magenta( "Enter your name: " ) ;
    // term.inputField(
    //     function( error , input ) {
    //         term.green( "\nYour name is '%s'\n" , input ) ;
    //     }
    // ) ;

    function terminate() {
        term.grabInput( false ) ;
        setTimeout( function() { process.exit() } , 100 ) ;
    }

    // term.bold.cyan( 'Type anything on the keyboard...\n' ) ;
    // term.green( 'Hit Q to quit.\n\n' ) ;
    //
    // term.grabInput( { mouse: 'button' } ) ;

    term.on( 'key' , function( name , matches , data ) {
        // console.log( "'key' event:" , name ) ;
        // if ( name === 'Q' ) { terminate() ; }
    } ) ;

    //
    // const inputData = await term.inputField().promise
    // term(`\nYou entered: ${inputData}\n`)

    //
    // const options = {
    //     prompt: 'What can I get you?'
    // };
    // const items = ['beer', 'pizza', 'tv-remote'];
    // const answer = await term.singleLineMenu(items, options).promise;
    // // term.column(0).eraseLine();
    // term(`\nYou chose: ${answer.selectedText}\n`);

    // await term.drawImage("tests/large_single.png", {
    //     shrink: {
    //         width: term.width,
    //         height: term.height * 2
    //     },
    //
    // })

    term.green("Please wait")
    term.spinner('lineSpinner');

    await sleep(10000);


    process.exit(0);

})();
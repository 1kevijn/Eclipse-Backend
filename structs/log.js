const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US');
    const time = now.toLocaleTimeString();
    
    return `${date} ${time}`; 
}

function formatLog(prefixColor, prefix, ...args) {
    let msg = args.join(" ");
    let formattedMessage = `${prefixColor}[${getTimestamp()}] ${prefix}\x1b[0m: ${msg}`;
    console.log(formattedMessage);
}

function backend(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[32m", "Eclipse Log", ...args);
    } else {
        console.log(`\x1b[32mEclipse Backend Log\x1b[0m: ${msg}`);
    }
}

function bot(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[33m", "Eclipse Bot Log", ...args);
    } else {
        console.log(`\x1b[33mEclipse Bot Log\x1b[0m: ${msg}`);
    }
}

function xmpp(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[34m", "Eclipse Xmpp Log", ...args);
    } else {
        console.log(`\x1b[34mEclipse Xmpp Log\x1b[0m: ${msg}`);
    }
}

function error(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[31m", "Eclipse Error Log", ...args);
    } else {
        console.log(`\x1b[31mEclipse Error Log\x1b[0m: ${msg}`);
    }
}

function debug(...args) {
    if (config.bEnableDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[35m", "Eclipse Debug Log", ...args);
        } else {
            console.log(`\x1b[35mEclipse Debug Log\x1b[0m: ${msg}`);
        }
    }
}

function website(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[36m", "Eclipse Website Log", ...args);
    } else {
        console.log(`\x1b[36mEclipse Website Log\x1b[0m: ${msg}`);
    }
}

function AutoRotation(...args) {
    if (config.bEnableAutoRotateDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[36m", "Eclipse AutoRotation Debug Log", ...args);
        } else {
            console.log(`\x1b[36mEclipse AutoRotation Debug Log\x1b[0m: ${msg}`);
        }
    }
}

function checkforupdate(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[33m", "Eclipse Update Log", ...args);
    } else {
        console.log(`\x1b[33mEclipse Update Log\x1b[0m: ${msg}`);
    }
}

function autobackendrestart(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[92m", "Eclipse Auto Backend Restart Log", ...args);
    } else {
        console.log(`\x1b[92mEclipse Auto Backend Restart\x1b[0m: ${msg}`);
    }
}

function calderaservice(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[91m", "Caldera Service Log", ...args);
    } else {
        console.log(`\x1b[91mCaldera Service\x1b[0m: ${msg}`);
    }
}

function launcher(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[96m", "Eclipse Launcher Log", ...args);
    } else {
        console.log(`\x1b[96mEclipse Launcher Log\x1b[0m: ${msg}`);
    }
}

module.exports = {
    backend,
    bot,
    xmpp,
    error,
    debug,
    website,
    AutoRotation,
    checkforupdate,
    autobackendrestart,
    calderaservice,
    launcher
};
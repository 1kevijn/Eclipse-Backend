const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require('crypto');
const kv = require("./structs/kv.js");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
const WebSocket = require('ws');
const https = require("https");
const User = require('./model/user.js');
const log = require("./structs/log.js");
const error = require("./structs/error.js");
const functions = require("./structs/functions.js");
const CheckForUpdate = require("./structs/checkforupdate.js");
const AutoBackendRestart = require("./structs/autobackendrestart.js");

// Try to load XMPPMonitor, create fallback if missing
let XMPPMonitor;
try {
    XMPPMonitor = require("./structs/xmpp-monitor.js");
} catch (err) {
    console.log("XMPP Monitor not found, using fallback...");
    XMPPMonitor = {
        getOnlineStatus: () => ({ online: 0, clients: [] }),
        startMonitoring: () => console.log("XMPP monitoring disabled"),
        logConnectionStatus: () => {}
    };
}

const { Client, Intents } = require('discord.js');
const bottoken = config.bot_token;


const app = express();

if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

global.JWT_SECRET = functions.MakeID();
const PORT = config.port;
const WEBSITEPORT = config.Website.websiteport;

let httpsServer;

if (config.bEnableHTTPS) {
    const httpsOptions = {
        cert: fs.readFileSync(config.ssl.cert),
        ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
        key: fs.readFileSync(config.ssl.key)
    };

    httpsServer = https.createServer(httpsOptions, app);
}

if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

global.JWT_SECRET = functions.MakeID();

console.log('Welcome to Eclipse Backend\n');

const tokens = JSON.parse(fs.readFileSync("./tokenManager/tokens.json").toString());

for (let tokenType in tokens) {
    for (let tokenIndex in tokens[tokenType]) {
        let decodedToken = jwt.decode(tokens[tokenType][tokenIndex].token.replace("eg1~", ""));

        if (DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime() <= new Date().getTime()) {
            tokens[tokenType].splice(Number(tokenIndex), 1);
        }
    }
}

fs.writeFileSync("./tokenManager/tokens.json", JSON.stringify(tokens, null, 2));

global.accessTokens = tokens.accessTokens;
global.refreshTokens = tokens.refreshTokens;
global.clientTokens = tokens.clientTokens;
global.kv = kv;

global.exchangeCodes = [];

let updateFound = false;

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "./package.json")).toString());
if (!packageJson) throw new Error("Failed to parse package.json");
const version = packageJson.version;

const checkUpdates = async () => {
    if (updateFound) return;

    try {
        const updateAvailable = await CheckForUpdate.checkForUpdate(version);
        if (updateAvailable) {
            updateFound = true;
        }
    } catch (err) {
        log.error("Failed to check for updates");
    }
};

checkUpdates();

setInterval(checkUpdates, 60000);

mongoose.set('strictQuery', true);

mongoose.connect(config.mongodb.database, () => {
    log.backend("App successfully connected to MongoDB!");
});

mongoose.connection.on("error", err => {
    log.error("MongoDB failed to connect, please make sure you have MongoDB installed and running.");
    throw err;
});

// CORS middleware for API connections
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// More lenient rate limiting for launcher API
app.use('/api/launcher', rateLimit({ windowMs: 1 * 60 * 1000, max: 100 })); // 100 requests per minute for launcher
app.use('/launcher', rateLimit({ windowMs: 1 * 60 * 1000, max: 100 })); // 100 requests per minute for launcher
app.use(rateLimit({ windowMs: 0.5 * 60 * 1000, max: 55 })); // Default rate limit for other endpoints

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Increase timeout for all requests
app.use((req, res, next) => {
    req.setTimeout(30000); // 30 seconds timeout
    res.setTimeout(30000);
    next();
});

fs.readdirSync("./routes").forEach(fileName => {
    try {
        app.use(require(`./routes/${fileName}`));
    } catch (err) {
        log.error(`Routes Error: Failed to load ${fileName}`)
    }
});

fs.readdirSync("./Api").forEach(fileName => {
    try {
        app.use(require(`./Api/${fileName}`));
    } catch (err) {
        log.error(`Eclipse API Error: Failed to load ${fileName}`)
    }
});

app.get("/unknown", (req, res) => {
    log.debug('GET /unknown endpoint called');
    res.json({ msg: "Eclipse" });
});

app.get("/online-status", (req, res) => {
    log.debug('GET /online-status endpoint called');
    const status = XMPPMonitor.getOnlineStatus();
    res.json(status);
});

// Health check endpoint for debugging connections
app.get("/health", (req, res) => {
    log.debug('GET /health endpoint called');
    res.status(200).json({ 
        status: "OK", 
        message: "Eclipse is running",
        timestamp: new Date().toISOString(),
        port: PORT,
        version: "1.1.5"
    });
});

// API status endpoint
app.get("/api/status", (req, res) => {
    log.debug('GET /api/status endpoint called');
    res.status(200).json({ 
        api_status: "active",
        launcher_api: "enabled",
        endpoints: [
            "/api/launcher/login",
            "/launcher/loginToken",
            "/launcher/checkdiscord",
            "/launcher/getDiscordId",
            "/launcher/getUsername",
            "/launcher/getAvatar"
        ],
        timestamp: new Date().toISOString()
    });
});

let server;
if (config.bEnableHTTPS) {
    server = httpsServer.listen(PORT, () => {
        log.backend(`Backend started listening on port ${PORT} (SSL Enabled)`);
        require("./xmpp/xmpp.js");
        if (config.discord.bUseDiscordBot === true) {
            try {
                require("./DiscordBot");
            } catch (err) {
                log.error("DiscordBot module not found, skipping Discord bot initialization");
            }
        }
        if (config.bUseAutoRotate === true) {
            require("./structs/autorotate.js");
        }
    }).on("error", async (err) => {
        if (err.code === "EADDRINUSE") {
            log.error(`Port ${PORT} is already in use!\nClosing in 3 seconds...`);
            await functions.sleep(3000);
            process.exit(0);
        } else {
            throw err;
        }
    });
} else {
    server = app.listen(PORT, () => {
        log.backend(`Backend started listening on port ${PORT} (SSL Disabled)`);
        require("./xmpp/xmpp.js");
        // Start XMPP monitoring
        XMPPMonitor.startMonitoring(5); // Every 5 minutes
        if (config.discord.bUseDiscordBot === true) {
            try {
                require("./DiscordBot");
            } catch (err) {
                log.error("DiscordBot module not found, skipping Discord bot initialization");
            }
        }
        if (config.bUseAutoRotate === true) {
            require("./structs/autorotate.js");
        }
    }).on("error", async (err) => {
        if (err.code === "EADDRINUSE") {
            log.error(`Port ${PORT} is already in use!\nClosing in 3 seconds...`);
            await functions.sleep(3000);
            process.exit(0);
        } else {
            throw err;
        }
    });
}

// WebSocket Server für Matchmaking
const WebSocketServer = require('ws').Server;
const matchmaker = require('./matchmaker/matchmaker.js');

// Erstelle WebSocket Server auf dem gleichen Port wie der Hauptserver
const wss = new WebSocketServer({ server: server });

wss.on('connection', async (ws, req) => {
    log.debug(`WebSocket connection established from: ${req.connection.remoteAddress}`);
    log.debug(`WebSocket URL: ${req.url}`);
    log.debug(`WebSocket protocol: ${ws.protocol}`);
    
    // Ping-Handler für Heartbeat
    ws.on('ping', () => {
        ws.pong();
    });
    
    // Alle WebSocket-Verbindungen werden als Matchmaking behandelt
    // da der Client direkt zum Matchmaker verbindet
    try {
        log.debug('Starting matchmaker for new connection');
        await matchmaker(ws);
    } catch (error) {
        log.error('Matchmaker error:', error);
        if (ws.readyState === ws.OPEN) {
            ws.close(1000, 'Matchmaker error');
        }
    }
});

wss.on('error', (error) => {
    log.error('WebSocket Server error:', error);
});

log.backend(`WebSocket Matchmaker Server started on port ${PORT}`);

if (config.bEnableAutoBackendRestart === true) {
    AutoBackendRestart.scheduleRestart(config.bRestartTime);
}

if (config.bEnableCalderaService === true) {
    const createCalderaService = require('./CalderaService/calderaservice');
    const calderaService = createCalderaService();

    let calderaHttpsOptions;
    if (config.bEnableHTTPS) {
        calderaHttpsOptions = {
            cert: fs.readFileSync(config.ssl.cert),
            ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
            key: fs.readFileSync(config.ssl.key)
        };
    }

    if (config.bEnableHTTPS) {
        const calderaHttpsServer = https.createServer(calderaHttpsOptions, calderaService);
        
        if (!config.bGameVersion) {
            log.calderaservice("Please define a version in the config!")
            return;
        }

        calderaHttpsServer.listen(config.bCalderaServicePort, () => {
            log.calderaservice(`Caldera Service started listening on port ${config.bCalderaServicePort} (SSL Enabled)`);
        }).on("error", async (err) => {
            if (err.code === "EADDRINUSE") {
                log.calderaservice(`Caldera Service port ${config.bCalderaServicePort} is already in use!\nClosing in 3 seconds...`);
                await functions.sleep(3000);
                process.exit(1);
            } else {
                throw err;
            }
        });
    } else {
        if (!config.bGameVersion) {
            log.calderaservice("Please define a version in the config!")
            return;
        }

        calderaService.listen(config.bCalderaServicePort, () => {
            log.calderaservice(`Caldera Service started listening on port ${config.bCalderaServicePort} (SSL Disabled)`);
        }).on("error", async (err) => {
            if (err.code === "EADDRINUSE") {
                log.calderaservice(`Caldera Service port ${config.bCalderaServicePort} is already in use!\nClosing in 3 seconds...`);
                await functions.sleep(3000);
                process.exit(1);
            } else {
                throw err;
            }
        });
    }
}

if (config.Website.bUseWebsite === true) {
    const websiteApp = express();
    require('./Website/website')(websiteApp);

    let httpsOptions;
    if (config.bEnableHTTPS) {
        httpsOptions = {
            cert: fs.readFileSync(config.ssl.cert),
            ca: fs.existsSync(config.ssl.ca) ? fs.readFileSync(config.ssl.ca) : undefined,
            key: fs.readFileSync(config.ssl.key)
        };
    }

    if (config.bEnableHTTPS) {
        const httpsServer = https.createServer(httpsOptions, websiteApp);
        httpsServer.listen(config.Website.websiteport, () => {
            log.website(`Website started listening on port ${config.Website.websiteport} (SSL Enabled)`);
        }).on("error", async (err) => {
            if (err.code === "EADDRINUSE") {
                log.error(`Website port ${config.Website.websiteport} is already in use!\nClosing in 3 seconds...`);
                await functions.sleep(3000);
                process.exit(1);
            } else {
                throw err;
            }
        });
    } else {
        websiteApp.listen(config.Website.websiteport, () => {
            log.website(`Website started listening on port ${config.Website.websiteport} (SSL Disabled)`);
        }).on("error", async (err) => {
            if (err.code === "EADDRINUSE") {
                log.error(`Website port ${config.Website.websiteport} is already in use!\nClosing in 3 seconds...`);
                await functions.sleep(3000);
                process.exit(1);
            } else {
                throw err;
            }
        });
    }
}

app.use((req, res, next) => {
    const url = req.originalUrl;
    log.debug(`Missing endpoint: ${req.method} ${url} request port ${req.socket.localPort}`);
    if (req.url.includes("..")) {
        res.redirect("https://youtu.be/dQw4w9WgXcQ");
        return;
    }
    error.createError(
        "errors.com.epicgames.common.not_found", 
        "Sorry the resource you were trying to find could not be found", 
        undefined, 1004, undefined, 404, res
    );
});

function generateRandomToken() {
    return crypto.randomBytes(16).toString('hex'); // 32-stelliger Hex-Token
}

function DateAddHours(pdate, number) {
    let date = pdate;
    date.setHours(date.getHours() + number);

    return date;
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS, // Zugriff auf Serverinformationen
        Intents.FLAGS.GUILD_MESSAGES, // Zugriff auf Nachrichten in Serverkanälen
        Intents.FLAGS.MESSAGE_CONTENT, // Zugriff auf den Inhalt von Nachrichten
        Intents.FLAGS.DIRECT_MESSAGES // Zugriff auf Direktnachrichten
    ]
});

// Login mit dem Bot-Token aus der config.json
client.login(config.discord.bot_token);

// Wenn der Bot bereit ist
client.once('ready', () => {
    console.log('Bot ist jetzt online!');
    // Wenn der Bot bereit ist, können wir sicher mit der Funktion fortfahren
    addTokensToExistingUsers();  // Funktion erst nach Bot-Login aufrufen
});

async function addTokensToExistingUsers() {
    try {
        // Hole alle Benutzer aus der Datenbank
        const users = await User.find();

        // Gehe durch jeden Benutzer und füge einen Token hinzu, falls noch keiner existiert
        for (const user of users) {
            // Wenn der Benutzer bereits einen Token hat (nicht leer, null oder undefined), überspringe diesen Benutzer
            if (user.token && user.token.trim() !== '') {
                console.log(`Benutzer ${user.username} hat bereits einen Token.`);
                continue;
            }

            // Generiere einen neuen Token, da der Benutzer noch keinen hat
            const token = generateRandomToken();  // Token erstellen
            user.token = token;  // Speichere den generierten Token in der Datenbank
            await user.save();  // Speichere den Benutzer mit dem neuen Token

            // Hole den Discord-Benutzer anhand der discordId
            if (user.discordId) {
                try {
                    const discordUser = await client.users.fetch(user.discordId);  // Hole den Discord-Nutzer

                    // Sende eine DM mit dem Token
                    await discordUser.send(`Hello ${user.username}, that's your new Token!: ${token}`);
                    console.log(`Token an ${user.username} gesendet: ${token}`);
                } catch (err) {
                    console.error(`Fehler beim Senden der DM an ${user.username}:`, err);
                }
            } else {
                console.log(`Benutzer ${user.username} hat keine Discord-ID.`);
            }
        }

        console.log("Tokens wurden zu den Benutzern hinzugefügt und per DM versendet!");
    } catch (err) {
        console.error("Fehler beim Hinzufügen der Tokens:", err);
    }
}


function generateRandomToken() {
    return crypto.randomBytes(16).toString('hex'); // 32-stelliger Hex-Token
}


// Wenn eine Nachricht empfangen wird


module.exports = app;

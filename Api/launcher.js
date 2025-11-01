const express = require("express");
const fs = require('fs');
const app = express.Router();
const User = require("../model/user.js");
const bcrypt = require("bcrypt");
const Profiles = require("../model/profiles.js");
const axios = require("axios");
const functions = require("../structs/functions.js");
const log = require("../structs/log.js");
const path = require('path');


app.get("/fetch/news1", sendData(async (req, res) => {
    const newsContent = {
        header: "Eclipse",
        date: "2024-05-27",
        desc: "Welcome to Eclipse! We host 5.41 Europe we are the #1 leading OGFN community, come in and join!."
    };

    return newsContent;
}));

app.get("/fetch/news2", sendData(async (req, res) => {
    const newsContent = {
        header: "Version 1.0.0",
        date: "2024-05-27",
        desc: "Eclipse Beta has officially released."
    };

    return newsContent;
}));

app.get("/fetch/news3", sendData(async (req, res) => {
    const newsContent = {
        header: "XP and Quests",
        date: "2024-05-27",
        desc: "Gear up for quests and challenges in Eclipse. Exciting adventures await as you explore the map and discover new locations. Don't miss out on the action!"
    };
// this is taking 15 years
    return newsContent;
}));


//Api for launcher login (If u want a POST requesto just replace "app.get" to "app.post" and "req.query" to "req.body")
app.get("/api/launcher/login", async (req, res) => {
    const { email, password } = req.query;

    // Überprüfen, ob die E-Mail und das Passwort vorhanden sind
    if (!email) return res.status(400).send('The email was not entered.');
    if (!password) return res.status(400).send('The password was not entered.');

    try {
        // Suche den Benutzer in der Datenbank anhand der E-Mail
        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).send('User not found.');

        // Überprüfe, ob das Passwort mit dem in der Datenbank übereinstimmt
        const passwordMatch = await bcrypt.compare(password, user.password);

        // Wenn das Passwort stimmt, sende nur den Benutzernamen als Text
        if (passwordMatch) {
            return res.status(200).send(user.username);  // Nur der Benutzername wird als Text zurückgegeben
        } else {
            return res.status(400).send('Error! Password does not match.');
        }
    } catch (err) {
        console.error('Launcher Api Error:', err);
        return res.status(500).send('Error encountered, look at the console');
    }
});


app.get("/fetch/version", (req, res) => {
    res.status(200).json({
        version: "0.1.5"
    });
});

// Helper function for error handling in endpoints
function sendData(block) {
    return async function (req, res) {
        try {
            const result = await block(req, res);
            if (!res.headersSent) {
                res.send(result);
            }
        } catch (error) {
            log.error(error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        }
    };
}

// Login Token Check
app.get('/launcher/loginToken', async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(500).json({ error: "real" });
        }

        return res.status(200).send();
    } catch (error) {
        return res.status(500).json({ error: "Server error" });
    }
});

// Login HWID Check
app.get('/launcher/loginHWID', async (req, res) => {
    const { discordId, hwid } = req.query;

    try {
        const updatedUser = await User.findOneAndUpdate(
            { discordId },
            { $set: { hwid } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).send();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// HWID Check
app.get('/launcher/checkhwid', async (req, res) => {
    const { hwid } = req.query;

    if (!hwid) {
        return res.status(400).json({ error: 'you need hwid bud' });
    }

    try {
        const user = await User.findOne({ hwid });

        if (!user) {
            return res.status(404).json();
        }

        if (user.banned) {
            return res.status(200).json("banned");
        }

        const discordId = user.discordId;
        return res.status(200).json(discordId);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/launcher/checkdiscord', async (req, res) => {
    const { discordId } = req.query;

    if (!discordId) {
        return res.status(400).json({ error: 'You need to provide a discordId' });
    }

    try {
        const user = await User.findOne({ discordId });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.banned) {
            return res.status(200).json("banned");
        }

        // Wenn der Benutzer gefunden wird und nicht gesperrt ist, geben wir die Discord-ID zurück
        return res.status(200).json(discordId);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});


app.get('/launcher/getDiscordId', async (req, res) => {
    const { token } = req.query;

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(404).json({ error: "istg" });
        }

        return res.status(200).json(user.discordId);
    } catch (error) {
        return res.status(500).json({ error: "server error" });
    }
});

app.get("/launcher/getUsername", sendData(async (req, res) => {
    const { discordId } = req.query;
// i hate my life
    if (!discordId) {
        return res.status(400).send("id thing is required");
    }

    const user = await User.findOne({ discordId });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return user.username;
}));

// Get Avatar for a Discord ID
app.get("/launcher/getAvatar", async (req, res) => {
    try {
        const { discordId } = req.query;

        // Check if Discord ID is provided
        if (!discordId) {
            return res.status(400).json({ error: "Discord ID is required" });
        }

        // Check if user exists in database first
        const user = await User.findOne({ discordId });
        if (!user) {
            return res.status(404).json({ error: "User not found in database" });
        }

        // Check if user is banned
        if (user.banned) {
            return res.status(403).json({ error: "User is banned" });
        }

        // Get bot token from config or environment
        const config = require("../Config/config.json");
        const botToken = process.env.DISCORD_BOT_TOKEN || config.discord?.bot_token;
        
        if (!botToken) {
            console.warn('Warning: Discord bot token not configured');
            // Return a fallback default avatar
            const defaultAvatarNumber = Math.floor(Math.random() * 5);
            const fallbackUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
            return res.send(fallbackUrl);
        }

        // Request Discord API to get user data
        const response = await axios.get(`https://discord.com/api/v10/users/${discordId}`, {
            headers: {
                'Authorization': `Bot ${botToken}`
            }
        });

        const userData = response.data;
        
        // Generate avatar URL
        let avatarUrl;
        if (userData.avatar) {
            // Check if avatar is animated (gif)
            const isAnimated = userData.avatar.startsWith('a_');
            const extension = isAnimated ? 'gif' : 'png';
            avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.${extension}?size=256`;
        } else {
            // Use default Discord avatar if user doesn't have one
            const defaultAvatarNumber = userData.discriminator ? 
                parseInt(userData.discriminator) % 5 : 
                Math.floor(Math.random() * 5);
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }

        // Return the avatar URL as plain text for compatibility
        return res.send(avatarUrl);

    } catch (error) {
        console.error(`Discord API Error: ${error.message}`);
        
        // Handle specific Discord API errors
        if (error.response) {
            if (error.response.status === 404) {
                // User not found on Discord, return default avatar
                const defaultAvatarNumber = Math.floor(Math.random() * 5);
                const defaultUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
                return res.send(defaultUrl);
            } else if (error.response.status === 401) {
                console.error("Discord API authentication failed - check bot token");
                return res.status(500).send("Discord integration error");
            } else if (error.response.status === 429) {
                console.error("Discord API rate limit exceeded");
                return res.status(429).send("Too many requests, try again later");
            }
        }
        
        // Return default avatar as fallback for any other errors
        const defaultAvatarNumber = Math.floor(Math.random() * 5);
        const fallbackUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        return res.send(fallbackUrl);
    }
});

// Get Selected Skin for a Discord ID
app.get("/selectedSkin", sendData(async (req, res) => {
    const { discordId } = req.query;

    if (!discordId) {
        console.error("Missing Discord ID");
        return res.status(400).send("Discord ID is required");
    }

    try {
        const user = await User.findOne({ discordId });

        if (!user) {
            console.error(`User not found for Discord ID: ${discordId}`);
            return res.status(404).json({ error: "User not found" });
        }

        const accountId = user.accountId;

        if (!accountId) {
            console.error(`Account ID not found for Discord ID: ${discordId}`);
            return res.status(400).json({ error: "Account ID not found for user" });
        }

        const profile = await Profiles.findOne({ accountId });

        if (!profile) {
            console.error(`Profile not found for Account ID: ${accountId}`);
            return res.status(404).json({ error: "Profile not found" });
        }

        const playercidthingy = profile.profiles.athena.stats.attributes.favorite_character;
        let cidthingy = playercidthingy ? playercidthingy.replace('AthenaCharacter:', '') : "CID_001_Athena_Commando_F_Default";

        console.log(`Fetching Fortnite cosmetic data for CID: ${cidthingy}`);
        const response = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/${cidthingy}`);
        const iconUrl = response.data.data.images.icon;

        if (!iconUrl) {
            console.error(`Icon not found for CID: ${cidthingy}`);
            return res.status(404).json({ error: "Icon not found" });
        }

        console.log(`Successfully fetched icon URL: ${iconUrl}`);
        return res.send(iconUrl);  // Send the icon URL as plain text
    } catch (error) {
        console.error(`Failed: ${error.message}`);
        return res.status(500).json({ error: "Fortnite API error" });
    }
}));

// Get V-Bucks balance for a Discord ID
app.get("/profile/vbucks", sendData(async (req, res) => {
    const { discordId } = req.query;

    if (!discordId) {
        return res.status(400).send("Discord ID is required");
    }

    const user = await User.findOne({ discordId });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const profile = await Profiles.findOne({ accountId: user.accountId });

    if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
    }

    const items = profile.profiles.common_core.items;
    const vbucksBalance = items && items["Currency:MtxPurchased"] ? items["Currency:MtxPurchased"].quantity : 0;

    res.json(vbucksBalance);
}));

// Exchange code endpoint
app.get("/fetch/exchange_code", async (req, res) => {
    const { discordId, hwid } = req.query;

    try {
        const user = await User.findOne({ discordId }).lean();

        if (!user) {
            return res.status(404).send();
        }

        if (user.hwid !== hwid) {
            return res.status(401).send();
        }

        let exchange_code = functions.MakeID().replace(/-/ig, "");
        global.exchangeCodes.push({
            accountId: user.accountId,
            exchange_code: exchange_code,
            creatingClientId: ""
        });

        setTimeout(() => {
            const exchangeCodeIndex = global.exchangeCodes.findIndex(i => i.exchange_code === exchange_code);
            if (exchangeCodeIndex !== -1) global.exchangeCodes.splice(exchangeCodeIndex, 1);
        }, 300000);

        res.status(200).send(exchange_code);
    } catch (error) {
        console.error(`Error for ${discordId}`, error);
        res.status(500).send("Error processing exchange code");
    }
});

// Funktion, um die Katalog-Konfigurationsdatei zu lesen
const getCatalogConfig = () => {
    // Der Pfad zur JSON-Datei im 'config' Ordner (auf der gleichen Ebene wie 'Api')
    const filePath = path.join(__dirname, '..', 'config', 'catalog_config.json');  // Pfad nach oben und dann in 'config' gehen
    const rawData = fs.readFileSync(filePath, 'utf-8');  // Datei wird synchron gelesen
    return JSON.parse(rawData);  // JSON wird in ein JavaScript-Objekt umgewandelt
};

app.get('/:itemid', async (req, res) => {
    const { itemid } = req.params;

    try {
        // Katalogdaten laden
        const catalogConfig = getCatalogConfig();

        // Prüfen, ob das angeforderte Item existiert
        if (catalogConfig[itemid]) {
            const item = catalogConfig[itemid];

            // Sicherstellen, dass itemGrants ein gültiges Array ist und price existiert
            if (Array.isArray(item.itemGrants) && item.itemGrants.length > 0 && item.price) {
                const itemGrant = item.itemGrants[0];

                // Extrahiere den Item-Typ (z.B. AthenaCharacter, AthenaPickaxe, etc.)
                const itemCategory = itemGrant.split(":")[0]; // Beispiel: AthenaCharacter
                const itemId = itemGrant.split(":")[1]; // Beispiel: CID_026_Athena_Commando_M

                // Anfrage an Fortnite API senden, um das Item zu holen
                const response = await axios.get(`https://fortnite-api.com/v2/cosmetics/br/${itemId}`);

                // Überprüfen, ob das Icon, der Name und der Preis existieren
                const iconUrl = response.data.data.images.icon;
                const itemName = response.data.data.name;

                // Sicherstellen, dass alle benötigten Daten vorhanden sind
                if (!iconUrl || !itemName) {
                    return res.status(404).json({ error: "Item data not found" });
                }

                // Formatierte Antwort zurückgeben im alten Format: "ItemName;Price;IconUrl"
                const formattedResponse = `${itemName};${item.price};${iconUrl}`;

                return res.send(formattedResponse); // Antwort senden
            } else {
                return res.status(400).json({ error: 'Invalid item format in catalog' });
            }
        } else {
            return res.status(404).json({ error: 'Item not found' });
        }
    } catch (error) {
        console.error(`Error reading catalog: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
});




// Endpunkt für das Abrufen der täglichen Artikel
// Endpunkt für das Abrufen der Artikel basierend auf der ID (z.B. daily1, daily2, featured1, featured2)



app.post("/launcher/hwidentry", async (req, res) => {
    try {
        const { discordId, hwid } = req.body;

        if (!discordId || !hwid) {
            return res.status(400).send("Discord ID and HWID are required.");
        }

        // Find user by discordId
        const user = await User.findOne({ discordId });

        if (!user) {
            return res.status(404).send("User not found.");
        }

        // Update HWID for the user
        user.hwid = hwid;  // Set the hwid
        await user.save();  // Save changes to the database

        console.log(`HWID for user ${discordId} has been updated.`);

        return res.status(200).send("HWID successfully updated.");
    } catch (error) {
        console.error("Error updating HWID:", error);
        return res.status(500).send("Error processing HWID update.");
    }
});


app.post('/claim-vbucks', async (req, res) => {
    try {
        const { discordId } = req.body; // discordId vom Launcher erhalten

        if (!discordId) {
            return res.status(400).json({ error: 'Discord ID is required' });
        }

        // Suche nach dem Benutzer anhand der Discord ID
        const user = await Users.findOne({ discordId: discordId });
        if (!user) {
            return res.status(404).json({ error: 'User not registered' });
        }

        // Benutzerprofil aus der Datenbank holen
        const userProfile = await Profiles.findOne({ accountId: user?.accountId });

        const lastClaimed = userProfile?.profiles?.lastVbucksClaim;
        if (lastClaimed && (Date.now() - new Date(lastClaimed).getTime() < 24 * 60 * 60 * 1000)) {
            const timeLeft = 24 - Math.floor((Date.now() - new Date(lastClaimed).getTime()) / (1000 * 60 * 60));
            return res.status(429).json({ error: `Already claimed. Wait ${timeLeft} hours.` });
        }

        // Aktualisierung des Benutzerprofils mit den neuen V-Bucks
        await Profiles.findOneAndUpdate(
            { accountId: user?.accountId },
            {
                $inc: { 'profiles.common_core.items.Currency:MtxPurchased.quantity': 250 },
                'profiles.lastVbucksClaim': Date.now()
            }
        );

        // Erfolgreiche Antwort
        res.status(200).json({ message: '250 V-Bucks claimed successfully!' });
    } catch (error) {
        console.error('Error in /claim-vbucks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = app;
const { Client, Intents, MessageEmbed } = require("discord.js");
const client = new Client({ 
    intents: [
        Intents.FLAGS.GUILDS, 
        Intents.FLAGS.GUILD_MESSAGES, 
        Intents.FLAGS.GUILD_MEMBERS, 
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_PRESENCES
    ] 
});
const fs = require("fs");
const path = require("path");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
const log = require("../structs/log.js");
const Users = require("../model/user.js");
const functions = require("../structs/functions.js");
const { giveBoostRewards, removeBoostRewards } = require("./commands/User/boost-rewards.js");

client.once("ready", () => {
    log.bot("Bot is up and running!");

    if (config.bEnableBackendStatus) {
        if (!config.bBackendStatusChannelId || config.bBackendStatusChannelId.trim() === "") {
            log.error("The channel ID has not been set in config.json for bEnableBackendStatus.");
        } else {
            const channel = client.channels.cache.get(config.bBackendStatusChannelId);
            if (!channel) {
                log.error(`Cannot find the channel with ID ${config.bBackendStatusChannelId}`);
            } else {
                const embed = new MessageEmbed()
                    .setTitle("Server Status")
                    .setDescription("Eclipse is now online")
                    .setColor("GREEN")
                    .setThumbnail("https://imgur.com/WT5gnsA.png")
                    .setFooter({ text: "Eclipse", iconURL: "https://imgur.com/WT5gnsA.png" })
                    .setTimestamp();

                channel.send({ embeds: [embed] }).catch(err => {
                    log.error(err);
                });
            }
        }
    }

    if (config.discord.bEnableInGamePlayerCount) {
        function updateBotStatus() {
            if (global.Clients && Array.isArray(global.Clients)) {
                client.user.setActivity(`${global.Clients.length} player(s)`, { type: "WATCHING" });
            }
        }

        updateBotStatus();
        setInterval(updateBotStatus, 10000);
    }

    let commands = client.application.commands;

    const loadCommands = (dir) => {
        fs.readdirSync(dir).forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                loadCommands(filePath);
            } else if (file.endsWith(".js")) {
                const command = require(filePath);
                commands.create(command.commandInfo);
            }
        });
    };

    loadCommands(path.join(__dirname, "commands"));
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    // Add a timeout to the entire interaction handling to prevent hanging
    const interactionTimeout = setTimeout(() => {
        log.error(`Interaction ${interaction.commandName} timed out after 12 seconds`);
    }, 12000); // 12 seconds timeout (3 seconds before Discord's 15s limit)

    const executeCommand = async (dir, commandName) => {
        const commandPath = path.join(dir, commandName + ".js");
        if (fs.existsSync(commandPath)) {
            try {
                // Clear require cache to avoid stale module issues
                delete require.cache[require.resolve(commandPath)];
                const command = require(commandPath);
                
                if (command && typeof command.execute === 'function') {
                    await command.execute(interaction);
                } else {
                    throw new Error(`Command ${commandName} does not have a valid execute function`);
                }
                return true;
            } catch (error) {
                log.error(`Error executing command ${commandName}:`, error.message || error);
                
                // More robust error response handling
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: "An error occurred while executing this command.", ephemeral: true });
                    } else if (interaction.deferred && !interaction.replied) {
                        await interaction.editReply({ content: "An error occurred while executing this command." });
                    }
                } catch (replyError) {
                    log.error("Failed to send error message to Discord:", replyError.message);
                }
                return true;
            }
        }
        
        // Search subdirectories
        try {
            const subdirectories = fs.readdirSync(dir).filter(subdir => 
                fs.lstatSync(path.join(dir, subdir)).isDirectory()
            );
            
            for (const subdir of subdirectories) {
                if (await executeCommand(path.join(dir, subdir), commandName)) {
                    return true;
                }
            }
        } catch (fsError) {
            log.error(`Error reading directory ${dir}:`, fsError.message);
        }
        
        return false;
    };

    try {
        const commandFound = await Promise.race([
            executeCommand(path.join(__dirname, "commands"), interaction.commandName),
            new Promise((resolve) => setTimeout(() => resolve(false), 11000)) // 11s timeout
        ]);
        
        if (!commandFound) {
            log.error(`Command ${interaction.commandName} not found or timed out`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "Command not found or took too long to execute.", ephemeral: true });
                }
            } catch (replyError) {
                log.error("Failed to reply with command not found message:", replyError.message);
            }
        }
    } catch (error) {
        log.error("Error in interactionCreate handler:", error.message || error);
        
        // Final fallback error handling
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "An unexpected error occurred.", ephemeral: true });
            }
        } catch (finalError) {
            log.error("Final error handler failed:", finalError.message);
        }
    } finally {
        clearTimeout(interactionTimeout);
    }
});

client.on("guildBanAdd", async (ban) => {
    if (!config.bEnableCrossBans) 
        return;

    const memberBan = await ban.fetch();

    if (memberBan.user.bot)
        return;

    const userData = await Users.findOne({ discordId: memberBan.user.id });

    if (userData && userData.banned !== true) {
        await userData.updateOne({ $set: { banned: true } });

        let refreshToken = global.refreshTokens.findIndex(i => i.accountId == userData.accountId);

        if (refreshToken != -1)
            global.refreshTokens.splice(refreshToken, 1);
        let accessToken = global.accessTokens.findIndex(i => i.accountId == userData.accountId);

        if (accessToken != -1) {
            global.accessTokens.splice(accessToken, 1);
            let xmppClient = global.Clients.find(client => client.accountId == userData.accountId);
            if (xmppClient)
                xmppClient.client.close();
        }

        if (accessToken != -1 || refreshToken != -1) {
            await functions.UpdateTokens();
        }

        log.debug(`user ${memberBan.user.username} (ID: ${memberBan.user.id}) was banned on the discord and also in the game (Cross Ban active).`);
    }
});

client.on("guildBanRemove", async (ban) => {
    if (!config.bEnableCrossBans) 
        return;

    if (ban.user.bot)
        return;

    const userData = await Users.findOne({ discordId: ban.user.id });
    
    if (userData && userData.banned === true) {
        await userData.updateOne({ $set: { banned: false } });

        log.debug(`User ${ban.user.username} (ID: ${ban.user.id}) is now unbanned.`);
    }
});

// Discord Server Boost Event Handler
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
        // Check if this is the correct server
        if (newMember.guild.id !== "1072170352635023410") return;

        const boostRoleId = "1073980334338752513";
        
        // Check if user gained the boost role
        const hadBoostRole = oldMember.roles.cache.has(boostRoleId);
        const hasBoostRole = newMember.roles.cache.has(boostRoleId);

        // Debug logging
        log.debug(`Role change detected for ${newMember.user.username}: hadBoost=${hadBoostRole}, hasBoost=${hasBoostRole}`);

        if (!hadBoostRole && hasBoostRole) {
            // User just got the boost role (boosted the server)
            log.bot(`${newMember.user.username} (${newMember.user.id}) just boosted the server!`);

            // Check if user has a game account
            const userData = await Users.findOne({ discordId: newMember.user.id });
            
            if (userData && !userData.boostRewardsClaimed) {
                // Give boost rewards automatically
                const result = await giveBoostRewards(userData.accountId, newMember.user.username);
                
                if (result.success) {
                    // Mark user as having claimed boost rewards
                    await Users.updateOne(
                        { accountId: userData.accountId },
                        { $set: { boostRewardsClaimed: true } }
                    );

                    // Send DM to user
                    try {
                        const embed = new MessageEmbed()
                            .setTitle("🚀 BOOST REWARDS RECEIVED!")
                            .setDescription(`**Thank you for boosting our Discord server!**\n\n` +
                                `You have automatically received:\n` +
                                `🎯 **Rust Lord** outfit\n` +
                                `🎒 **Rust Bucket** backbling\n` +
                                `💎 **500 V-Bucks**\n\n` +
                                `Check your in-game locker and gift box!`)
                            .setColor("GREEN")
                            .setThumbnail("https://i.imgur.com/yLbihQa.png")
                            .setFooter({
                                text: "Eclipse - Thank you for your support!",
                                iconURL: "https://i.imgur.com/yLbihQa.png"
                            })
                            .setTimestamp();

                        await newMember.send({ embeds: [embed] });
                        log.bot(`Boost rewards sent to ${newMember.user.username}`);
                    } catch (dmError) {
                        log.error(`Could not send DM to ${newMember.user.username}: ${dmError.message}`);
                    }

                    // Optional: Send message to a channel
                    if (config.bBoostRewardsChannelId && config.bBoostRewardsChannelId.trim() !== "") {
                        const channel = client.channels.cache.get(config.bBoostRewardsChannelId);
                        if (channel) {
                            const publicEmbed = new MessageEmbed()
                                .setTitle("🚀 NEW SERVER BOOST!")
                                .setDescription(`**${newMember.user.username}** just boosted our server and received exclusive rewards!\n\n` +
                                    `🎯 Rust Lord outfit\n` +
                                    `🎒 Rust Bucket backbling\n` +
                                    `💎 500 V-Bucks\n\n` +
                                    `**Want these rewards too? Boost our server!**`)
                                .setColor("PURPLE")
                                .setThumbnail(newMember.user.displayAvatarURL())
                                .setFooter({
                                    text: "Eclipse - Boost for exclusive rewards!",
                                    iconURL: "https://i.imgur.com/2RImwlb.png"
                                })
                                .setTimestamp();

                            channel.send({ embeds: [publicEmbed] }).catch(err => {
                                log.error(`Failed to send boost notification to channel: ${err.message}`);
                            });
                        } else {
                            log.error(`Boost rewards channel not found: ${config.bBoostRewardsChannelId}`);
                        }
                    }
                } else {
                    log.error(`Failed to give boost rewards to ${newMember.user.username}: ${result.error}`);
                }
            } else if (userData && userData.boostRewardsClaimed) {
                // User already claimed rewards
                try {
                    await newMember.send("Thank you for boosting our server again! You have already received your boost rewards. 🚀");
                } catch (dmError) {
                    log.error(`Could not send DM to ${newMember.user.username}: ${dmError.message}`);
                }
            } else {
                // User doesn't have a game account
                try {
                    const embed = new MessageEmbed()
                        .setTitle("🚀 THANK YOU FOR BOOSTING!")
                        .setDescription(`**Thank you for boosting our Discord server!**\n\n` +
                            `To claim your exclusive rewards:\n` +
                            `🎯 **Rust Lord** outfit\n` +
                            `🎒 **Rust Bucket** backbling\n` +
                            `💎 **500 V-Bucks**\n\n` +
                            `Please create a game account first using the \`/create\` command, then use \`/boost-rewards\` to claim your rewards!`)
                        .setColor("PURPLE")
                        .setThumbnail("https://imgur.com/WT5gnsA.png")
                        .setFooter({
                            text: "Eclipse - Create an account to claim rewards!",
                            iconURL: "https://imgur.com/WT5gnsA.png"
                        })
                        .setTimestamp();

                    await newMember.send({ embeds: [embed] });
                } catch (dmError) {
                    log.error(`Could not send DM to ${newMember.user.username}: ${dmError.message}`);
                }
            }
        } else if (hadBoostRole && !hasBoostRole) {
            // User lost the boost role (removed boost)
            log.bot(`${newMember.user.username} (${newMember.user.id}) removed their server boost!`);

            // Check if user has a game account and had claimed boost rewards
            const userData = await Users.findOne({ discordId: newMember.user.id });
            
            if (userData && userData.boostRewardsClaimed) {
                // Remove boost rewards
                const result = await removeBoostRewards(userData.accountId, newMember.user.username);
                
                if (result.success) {
                    // Mark user as not having claimed boost rewards
                    await Users.updateOne(
                        { accountId: userData.accountId },
                        { $set: { boostRewardsClaimed: false } }
                    );

                    // Send DM to user
                    try {
                        const embed = new MessageEmbed()
                            .setTitle("❌ BOOST REWARDS REMOVED")
                            .setDescription(`**Your server boost has been removed.**\n\n` +
                                `The following items have been removed from your account:\n` +
                                `🎯 **Rust Lord** outfit\n` +
                                `🎒 **Rust Bucket** backbling\n` +
                                `💎 **500 V-Bucks**\n\n` +
                                `Boost our server again to get these rewards back!`)
                            .setColor("RED")
                            .setThumbnail("https://imgur.com/WT5gnsA.png")
                            .setFooter({
                                text: "Eclipse - Boost to get rewards back!",
                                iconURL: "https://imgur.com/WT5gnsA.png"
                            })
                            .setTimestamp();

                        await newMember.send({ embeds: [embed] });
                        log.bot(`Boost rewards removed from ${newMember.user.username}`);
                    } catch (dmError) {
                        log.error(`Could not send DM to ${newMember.user.username}: ${dmError.message}`);
                    }

                    // Optional: Send message to a channel
                    if (config.bBoostRewardsChannelId && config.bBoostRewardsChannelId.trim() !== "") {
                        const channel = client.channels.cache.get(config.bBoostRewardsChannelId);
                        if (channel) {
                            const publicEmbed = new MessageEmbed()
                                .setTitle("❌ BOOST REMOVED")
                                .setDescription(`**${newMember.user.username}** removed their server boost.\n\n` +
                                    `Their exclusive rewards have been removed:\n` +
                                    `🎯 Rust Lord outfit\n` +
                                    `🎒 Rust Bucket backbling\n` +
                                    `💎 500 V-Bucks\n\n` +
                                    `**Boost our server to get exclusive rewards!**`)
                                .setColor("RED")
                                .setThumbnail(newMember.user.displayAvatarURL())
                                .setFooter({
                                    text: "Eclipse - Boost for exclusive rewards!",
                                    iconURL: "https://imgur.com/WT5gnsA.png"
                                })
                                .setTimestamp();

                            channel.send({ embeds: [publicEmbed] }).catch(err => {
                                log.error(`Failed to send boost removal notification to channel: ${err.message}`);
                            });
                        } else {
                            log.error(`Boost rewards channel not found: ${config.bBoostRewardsChannelId}`);
                        }
                    }
                } else {
                    log.error(`Failed to remove boost rewards from ${newMember.user.username}: ${result.error}`);
                }
            }
        }
    } catch (error) {
        log.error(`Error in guildMemberUpdate (boost detection): ${error.message}`);
    }
});

// Discord Server Leave Event Handler
client.on("guildMemberRemove", async (member) => {
    try {
        // Check if this is the correct server
        if (member.guild.id !== "1072170352635023410") return;

        log.bot(`${member.user.username} (${member.user.id}) left the server`);

        // Check if user has a game account and had claimed boost rewards
        const userData = await Users.findOne({ discordId: member.user.id });
        
        if (userData && userData.boostRewardsClaimed) {
            log.bot(`Removing boost rewards from ${member.user.username} (left server)`);
            
            // Remove boost rewards
            const result = await removeBoostRewards(userData.accountId, member.user.username);
            
            if (result.success) {
                // Mark user as not having claimed boost rewards
                await Users.updateOne(
                    { accountId: userData.accountId },
                    { $set: { boostRewardsClaimed: false } }
                );

                log.bot(`Boost rewards removed from ${member.user.username} (server leave)`);

                // Optional: Send message to a channel
                if (config.bBoostRewardsChannelId && config.bBoostRewardsChannelId.trim() !== "") {
                    const channel = client.channels.cache.get(config.bBoostRewardsChannelId);
                    if (channel) {
                        const publicEmbed = new MessageEmbed()
                            .setTitle("👋 USER LEFT - BOOST REWARDS REMOVED")
                            .setDescription(`**${member.user.username}** left the server.\n\n` +
                                `Their boost rewards have been automatically removed:\n` +
                                `🎯 Rust Lord outfit\n` +
                                `🎒 Rust Bucket backbling\n` +
                                `💎 500 V-Bucks\n\n` +
                                `**Join and boost our server to get exclusive rewards!**`)
                            .setColor("ORANGE")
                            .setThumbnail(member.user.displayAvatarURL())
                            .setFooter({
                                text: "Eclipse - Boost for exclusive rewards!",
                                iconURL: "https://imgur.com/WT5gnsA.png"
                            })
                            .setTimestamp();

                        channel.send({ embeds: [publicEmbed] }).catch(err => {
                            log.error(`Failed to send server leave notification to channel: ${err.message}`);
                        });
                    }
                }
            } else {
                log.error(`Failed to remove boost rewards from ${member.user.username} (server leave): ${result.error}`);
            }
        }
    } catch (error) {
        log.error(`Error in guildMemberRemove (boost cleanup): ${error.message}`);
    }
});

// Discord Server Join Event Handler
client.on("guildMemberAdd", async (member) => {
    try {
        // Check if this is the correct server
        if (member.guild.id !== "1072170352635023410") return;

        log.bot(`${member.user.username} (${member.user.id}) joined the server`);

        // Check if user has a game account and had claimed boost rewards before
        const userData = await Users.findOne({ discordId: member.user.id });
        
        if (userData && userData.boostRewardsClaimed) {
            // User rejoined but doesn't have boost role anymore, remove rewards
            const boostRoleId = "1073980334338752513";
            const hasBoostRole = member.roles.cache.has(boostRoleId);
            
            if (!hasBoostRole) {
                log.bot(`Removing boost rewards from ${member.user.username} (rejoined without boost)`);
                
                // Remove boost rewards
                const result = await removeBoostRewards(userData.accountId, member.user.username);
                
                if (result.success) {
                    // Mark user as not having claimed boost rewards
                    await Users.updateOne(
                        { accountId: userData.accountId },
                        { $set: { boostRewardsClaimed: false } }
                    );

                    log.bot(`Boost rewards removed from ${member.user.username} (rejoined without boost role)`);

                    // Send DM to user
                    try {
                        const embed = new MessageEmbed()
                            .setTitle("👋 WELCOME BACK!")
                            .setDescription(`**Welcome back to our Discord server!**\n\n` +
                                `Since you don't have an active server boost, your previous boost rewards have been removed:\n` +
                                `🎯 **Rust Lord** outfit\n` +
                                `🎒 **Rust Bucket** backbling\n` +
                                `💎 **500 V-Bucks**\n\n` +
                                `**Boost our server to get these exclusive rewards back!**`)
                            .setColor("ORANGE")
                            .setThumbnail("https://imgur.com/WT5gnsA.png")
                            .setFooter({
                                text: "Eclipse - Boost for exclusive rewards!",
                                iconURL: "https://imgur.com/WT5gnsA.png"
                            })
                            .setTimestamp();

                        await member.send({ embeds: [embed] });
                    } catch (dmError) {
                        log.error(`Could not send DM to ${member.user.username}: ${dmError.message}`);
                    }
                }
            } else {
                // User rejoined and still has boost role, keep rewards
                log.bot(`${member.user.username} rejoined with boost role, keeping rewards`);
            }
        }
    } catch (error) {
        log.error(`Error in guildMemberAdd (boost check): ${error.message}`);
    }
});

//AntiCrash System
client.on("error", (err) => {
    console.log("Discord API Error:", err);
});
  
process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled promise rejection:", reason, p);
});
  
process.on("uncaughtException", (err, origin) => {
    console.log("Uncaught Exception:", err, origin);
});
  
process.on("uncaughtExceptionMonitor", (err, origin) => {
    console.log("Uncaught Exception Monitor:", err, origin);
});

client.login(config.discord.bot_token);
const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const functions = require('../../../structs/functions');
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "manage-free-battlepass",
        description: "Manage free Battle Pass for users",
        options: [
            {
                name: "action",
                description: "Action to perform",
                required: true,
                type: 3, // STRING
                choices: [
                    {
                        name: "grant",
                        value: "grant"
                    },
                    {
                        name: "reset",
                        value: "reset"
                    },
                    {
                        name: "check",
                        value: "check"
                    }
                ]
            },
            {
                name: "username",
                description: "Username to manage",
                required: true,
                type: 3 // STRING
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        // Check if user has admin permissions
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
            return interaction.editReply({ 
                content: "❌ You don't have permission to use this command.", 
                ephemeral: true 
            });
        }

        const action = interaction.options.getString("action");
        const username = interaction.options.getString("username");

        try {
            const user = await Users.findOne({ username: username });
            if (!user) {
                return interaction.editReply({ 
                    content: `❌ User "${username}" not found.`, 
                    ephemeral: true 
                });
            }

            const profiles = await Profiles.findOne({ accountId: user.accountId });
            if (!profiles) {
                return interaction.editReply({ 
                    content: `❌ Profile for user "${username}" not found.`, 
                    ephemeral: true 
                });
            }

            const athena = profiles.profiles["athena"];
            const common_core = profiles.profiles["common_core"];

            switch (action) {
                case "check":
                    const embed = new MessageEmbed()
                        .setTitle("🎯 FREE BATTLE PASS STATUS")
                        .setDescription(`**Status for user: ${username}**\n\n` +
                            `✅ **Free Battle Pass Claimed:** ${user.freeBattlePassClaimed ? 'Yes' : 'No'}\n` +
                            `🎮 **Battle Pass Purchased:** ${athena.stats.attributes.book_purchased ? 'Yes' : 'No'}\n` +
                            `📊 **Account Level:** ${athena.stats.attributes.accountLevel || 1}\n` +
                            `🏆 **Season Level:** ${athena.stats.attributes.level || 1}`)
                        .setColor("BLUE")
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed], ephemeral: true });

                case "grant":
                    if (user.freeBattlePassClaimed) {
                        return interaction.editReply({ 
                            content: `❌ User "${username}" has already claimed their free Battle Pass.`, 
                            ephemeral: true 
                        });
                    }

                    // Grant Battle Pass
                    await grantFreeBattlePass(user.accountId, profiles);
                    
                    return interaction.editReply({ 
                        content: `✅ Free Battle Pass granted to user "${username}".`, 
                        ephemeral: true 
                    });

                case "reset":
                    // Reset Battle Pass status
                    athena.stats.attributes.book_purchased = false;
                    
                    // Remove Battle Pass token
                    const memory = functions.GetVersionInfo({ headers: { "user-agent": "Fortnite/++Fortnite+Release-9.40-CL-6005771 Windows/10.0.17763.1.256.64bit" } });
                    const OnlySeasonNumber = memory.season;
                    const tokenKey = `Token:Athena_S${OnlySeasonNumber}_NoBattleBundleOption_Token`;
                    
                    if (common_core.items[tokenKey]) {
                        delete common_core.items[tokenKey];
                    }

                    // Update profile versions
                    athena.rvn += 1;
                    athena.commandRevision += 1;
                    athena.updated = new Date().toISOString();
                    
                    common_core.rvn += 1;
                    common_core.commandRevision += 1;
                    common_core.updated = new Date().toISOString();

                    // Save to database
                    await Profiles.updateOne(
                        { accountId: user.accountId },
                        { 
                            $set: { 
                                'profiles.athena': athena,
                                'profiles.common_core': common_core
                            } 
                        }
                    );

                    // Reset user flag
                    await Users.updateOne(
                        { accountId: user.accountId },
                        { $set: { freeBattlePassClaimed: false } }
                    );

                    return interaction.editReply({ 
                        content: `✅ Free Battle Pass status reset for user "${username}". They can now claim it again after completing a match.`, 
                        ephemeral: true 
                    });

                default:
                    return interaction.editReply({ 
                        content: "❌ Invalid action.", 
                        ephemeral: true 
                    });
            }

        } catch (error) {
            console.error("Error managing free Battle Pass:", error);
            return interaction.editReply({ 
                content: "❌ An error occurred while managing the free Battle Pass.", 
                ephemeral: true 
            });
        }
    }
};

// Function to grant free Battle Pass
async function grantFreeBattlePass(accountId, profiles) {
    const athena = profiles.profiles["athena"];
    const common_core = profiles.profiles["common_core"];
    
    // Get season info
    const memory = functions.GetVersionInfo({ headers: { "user-agent": "Fortnite/++Fortnite+Release-9.40-CL-6005771 Windows/10.0.17763.1.256.64bit" } });
    const OnlySeasonNumber = memory.season;

    // Activate Battle Pass
    athena.stats.attributes.book_purchased = true;
    
    // Add Battle Pass token to common_core
    const tokenKey = `Token:Athena_S${OnlySeasonNumber}_NoBattleBundleOption_Token`;
    const tokenData = {
        "templateId": `Token:athena_s${OnlySeasonNumber}_nobattlebundleoption_token`,
        "attributes": {
            "max_level_bonus": 0,
            "level": 1,
            "item_seen": true,
            "xp": 0,
            "favorite": false
        },
        "quantity": 1
    };

    common_core.items[tokenKey] = tokenData;

    // Create gift box notification
    const giftBoxId = functions.MakeID();
    const giftBox = {
        "templateId": "GiftBox:gb_battlepass",
        "attributes": {
            "max_level_bonus": 0,
            "fromAccountId": "Eclipse-Admin",
            "lootList": [
                {
                    "itemType": tokenData.templateId,
                    "itemGuid": tokenData.templateId,
                    "quantity": 1
                }
            ],
            "params": {
                "userMessage": "Free Battle Pass granted by admin!"
            },
            "giftedOn": new Date().toISOString()
        },
        "quantity": 1
    };

    common_core.items[giftBoxId] = giftBox;

    // Update profile versions
    athena.rvn += 1;
    athena.commandRevision += 1;
    athena.updated = new Date().toISOString();
    
    common_core.rvn += 1;
    common_core.commandRevision += 1;
    common_core.updated = new Date().toISOString();

    // Save to database
    await Profiles.updateOne(
        { accountId: accountId },
        { 
            $set: { 
                'profiles.athena': athena,
                'profiles.common_core': common_core
            } 
        }
    );

    // Mark user as having claimed free Battle Pass
    await Users.updateOne(
        { accountId: accountId },
        { $set: { freeBattlePassClaimed: true } }
    );
}
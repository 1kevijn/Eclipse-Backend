const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const config = require('../../../Config/config.json');
const uuid = require("uuid");
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "manage-free-battlepass",
        description: "Manage Free Battle Pass system for users",
        options: [
            {
                name: "action",
                description: "Action to perform",
                required: true,
                type: 3,
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
                name: "user",
                description: "The user to manage",
                required: true,
                type: 6
            }
        ]
    },
    execute: async (interaction) => {
        // Check permissions before deferring to avoid unnecessary API calls
        if (!config.moderators.includes(interaction.user.id)) {
            return await interaction.reply({ content: "❌ You do not have moderator permissions.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const action = interaction.options.getString('action');
        const selectedUser = interaction.options.getUser('user');
        const selectedUserId = selectedUser?.id;
        const user = await Users.findOne({ discordId: selectedUserId });

        if (!user) {
            return interaction.editReply({ content: "❌ That user does not own an account", ephemeral: true });
        }

        const profiles = await Profiles.findOne({ accountId: user.accountId });
        if (!profiles) {
            return interaction.editReply({ content: "❌ Profile data not found for that user", ephemeral: true });
        }

        const athenaProfile = profiles.profiles.athena;
        const commonCoreProfile = profiles.profiles.common_core;
        const hasBattlePass = athenaProfile.stats.attributes.book_purchased === true;
        const battlePassLevel = athenaProfile.stats.attributes.book_level || 1;

        let embed = new MessageEmbed()
            .setThumbnail("https://imgur.com/WT5gnsA.png")
            .setTimestamp()
            .setFooter({
                text: "Eclipse - Admin Panel",
                iconURL: "https://imgur.com/WT5gnsA.png"
            });

        switch (action) {
            case "check":
                embed.setColor("BLUE")
                    .setTitle("🔍 Free Battle Pass Status Check")
                    .setDescription(`Status for **${user.username}** (<@${selectedUserId}>)`)
                    .addFields(
                        { name: "👤 Username", value: user.username, inline: true },
                        { name: "🆔 Account ID", value: user.accountId, inline: true },
                        { name: "🎮 Battle Pass", value: hasBattlePass ? "✅ Premium" : "❌ Free", inline: true },
                        { name: "📊 Current Level", value: `Level ${battlePassLevel}`, inline: true },
                        { name: "🎁 Free Claim Used", value: user.freeBattlePassClaimed ? "✅ Yes" : "❌ No", inline: true },
                        { name: "🚫 Banned", value: user.banned ? "✅ Yes" : "❌ No", inline: true }
                    );
                break;

            case "reset":
                if (!user.freeBattlePassClaimed) {
                    return interaction.editReply({ 
                        content: "❌ That user hasn't claimed their free Battle Pass yet.", 
                        ephemeral: true 
                    });
                }

                user.freeBattlePassClaimed = false;
                await user.save();

                embed.setColor("YELLOW")
                    .setTitle("🔄 Free Battle Pass Reset")
                    .setDescription(`Successfully reset Free Battle Pass claim for **${user.username}**`)
                    .addFields(
                        { name: "👤 User", value: `<@${selectedUserId}>`, inline: true },
                        { name: "📝 Action", value: "Claim status reset", inline: true },
                        { name: "🎯 Result", value: "User can now claim again", inline: true }
                    );
                break;

            case "grant":
                if (user.freeBattlePassClaimed && hasBattlePass) {
                    return interaction.editReply({ 
                        content: "❌ That user already has the Battle Pass and has used their free claim.", 
                        ephemeral: true 
                    });
                }

                try {
                    // Load Battle Pass data for Season 8 (or current season)
                    const season = 8; // You can make this dynamic
                    let BattlePassData;
                    try {
                        BattlePassData = require(`../../../responses/Athena/BattlePass/Season${season}.json`);
                    } catch (err) {
                        return interaction.editReply({ 
                            content: `❌ No Battle Pass data found for season ${season}`, 
                            ephemeral: true 
                        });
                    }

                    // Grant Battle Pass token to common_core
                    const battlePassTokenId = uuid.v4();
                    commonCoreProfile.items[battlePassTokenId] = {
                        "templateId": `Token:battlepass_season${season}`,
                        "attributes": {
                            "creation_time": new Date().toISOString(),
                            "level": -1,
                            "item_seen": false,
                            "sent_new_notification": false,
                            "xp_reward_scalar": 1,
                            "max_level_bonus": 0,
                            "xp": 0,
                            "favorite": false
                        },
                        "quantity": 1
                    };

                    // Mark Battle Pass as purchased
                    athenaProfile.stats.attributes.book_purchased = true;

                    // Grant all premium rewards up to current level
                    let totalVBucks = 0;
                    let itemsGranted = 0;
                    
                    for (let i = 0; i < battlePassLevel && i < BattlePassData.paidRewards.length; i++) {
                        const tierRewards = BattlePassData.paidRewards[i];
                        
                        for (const [templateId, quantity] of Object.entries(tierRewards)) {
                            if (templateId.startsWith("Currency:mtxgiveaway")) {
                                totalVBucks += quantity;
                            } else if (templateId.startsWith("HomebaseBannerIcon:")) {
                                const itemId = uuid.v4();
                                commonCoreProfile.items[itemId] = {
                                    "templateId": templateId,
                                    "attributes": {
                                        "creation_time": new Date().toISOString(),
                                        "level": -1,
                                        "item_seen": false,
                                        "sent_new_notification": false,
                                        "xp_reward_scalar": 1,
                                        "max_level_bonus": 0,
                                        "xp": 0,
                                        "favorite": false
                                    },
                                    "quantity": quantity
                                };
                                itemsGranted++;
                            } else if (templateId.startsWith("Token:")) {
                                const itemId = uuid.v4();
                                commonCoreProfile.items[itemId] = {
                                    "templateId": templateId,
                                    "attributes": {
                                        "creation_time": new Date().toISOString(),
                                        "level": -1,
                                        "item_seen": false,
                                        "sent_new_notification": false,
                                        "xp_reward_scalar": 1,
                                        "max_level_bonus": 0,
                                        "xp": 0,
                                        "favorite": false
                                    },
                                    "quantity": quantity
                                };
                                itemsGranted++;
                            } else {
                                const itemId = uuid.v4();
                                athenaProfile.items[itemId] = {
                                    "templateId": templateId,
                                    "attributes": {
                                        "creation_time": new Date().toISOString(),
                                        "level": -1,
                                        "item_seen": false,
                                        "sent_new_notification": false,
                                        "xp_reward_scalar": 1,
                                        "max_level_bonus": 0,
                                        "xp": 0,
                                        "favorite": false,
                                        "variants": []
                                    },
                                    "quantity": quantity
                                };
                                itemsGranted++;
                            }
                        }
                    }

                    // Add V-Bucks to currency
                    if (totalVBucks > 0) {
                        for (const key in commonCoreProfile.items) {
                            if (commonCoreProfile.items[key].templateId === "Currency:MtxPurchased") {
                                commonCoreProfile.items[key].quantity += totalVBucks;
                                break;
                            }
                        }
                    }

                    // Create gift box notification
                    const giftBoxId = uuid.v4();
                    const lootList = [{
                        "itemType": `Token:battlepass_season${season}`,
                        "itemGuid": `Token:battlepass_season${season}`,
                        "itemProfile": "common_core",
                        "quantity": 1
                    }];

                    athenaProfile.items[giftBoxId] = {
                        "templateId": "GiftBox:gb_battlepass",
                        "attributes": {
                            "max_level_bonus": 0,
                            "fromAccountId": `[Administrator]`,
                            "lootList": lootList,
                            "params": {
                                "userMessage": "Free Battle Pass granted by Administrator!"
                            },
                            "level": -1,
                            "item_seen": false
                        },
                        "quantity": 1
                    };

                    // Update profiles in database
                    await profiles.updateOne({ 
                        $set: { 
                            [`profiles.athena`]: athenaProfile,
                            [`profiles.common_core`]: commonCoreProfile
                        } 
                    });

                    // Mark as claimed
                    user.freeBattlePassClaimed = true;
                    await user.save();

                    embed.setColor("GREEN")
                        .setTitle("🎁 Free Battle Pass Granted")
                        .setDescription(`Successfully granted Free Battle Pass to **${user.username}**`)
                        .addFields(
                            { name: "👤 User", value: `<@${selectedUserId}>`, inline: true },
                            { name: "🎯 Season", value: `Season ${season}`, inline: true },
                            { name: "📊 Level", value: `${battlePassLevel}`, inline: true },
                            { name: "🎁 Items Granted", value: `${itemsGranted} items`, inline: true },
                            { name: "💎 V-Bucks Added", value: `${totalVBucks} V-Bucks`, inline: true },
                            { name: "📦 Gift Box", value: "✅ Created", inline: true }
                        );

                } catch (err) {
                    console.error("Error granting Battle Pass:", err);
                    return interaction.editReply({ 
                        content: "❌ An error occurred while granting the Battle Pass. Check console for details.", 
                        ephemeral: true 
                    });
                }
                break;

            default:
                return interaction.editReply({ content: "❌ Invalid action specified.", ephemeral: true });
        }

        interaction.editReply({ embeds: [embed], ephemeral: true });
    }
};
const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const config = require('../../../Config/config.json');
const uuid = require("uuid");
const { MessageEmbed } = require("discord.js");
const fs = require('fs');
const path = require('path');
const destr = require('destr');

module.exports = {
    commandInfo: {
        name: "boost-rewards",
        description: "Claim your exclusive Discord Boost rewards!",
        options: []
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const user = await Users.findOne({ discordId: userId });

        if (!user) {
            return interaction.editReply({ 
                content: "You need to create an account first! Use `/create` command.", 
                ephemeral: true 
            });
        }

        // Check if user has boost role
        const member = interaction.member;
        const boostRoleId = "1073980334338752513"; // Your boost role ID
        
        if (!member.roles.cache.has(boostRoleId)) {
            const embed = new MessageEmbed()
                .setTitle("🚀 BOOST THE DISCORD SERVER TO GET EXCLUSIVE REWARDS!")
                .setDescription(`**Boost our Discord server to unlock exclusive rewards:**\n\n` +
                    `🎯 **Rust Lord** outfit\n` +
                    `🎒 **Rust Bucket** backbling\n` +
                    `💎 **500 V-Bucks**\n\n` +
                    `**How to boost:**\n` +
                    `1. Click on the server name at the top\n` +
                    `2. Select "Server Boost"\n` +
                    `3. Choose your boost and confirm\n` +
                    `4. Come back and use this command again!\n\n` +
                    `**Discord Server ID:** 1072170352635023410`)
                .setColor("PURPLE")
                .setThumbnail("https://imgur.com/WT5gnsA.png")
                .setFooter({
                    text: "Eclipse - Boost for exclusive rewards!",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Check if user already claimed boost rewards
        if (user.boostRewardsClaimed) {
            return interaction.editReply({ 
                content: "You have already claimed your boost rewards! Thank you for supporting our server! 🚀", 
                ephemeral: true 
            });
        }

        // Give boost rewards
        const result = await giveBoostRewards(user.accountId, interaction.user.username);
        
        if (result.success) {
            // Mark user as having claimed boost rewards
            await Users.updateOne(
                { accountId: user.accountId },
                { $set: { boostRewardsClaimed: true } }
            );

            const embed = new MessageEmbed()
                .setTitle("🚀 BOOST REWARDS CLAIMED!")
                .setDescription(`**Thank you for boosting our Discord server!**\n\n` +
                    `You have received:\n` +
                    `🎯 **Rust Lord** outfit\n` +
                    `🎒 **Rust Bucket** backbling\n` +
                    `💎 **500 V-Bucks**\n\n` +
                    `Check your in-game locker and gift box!`)
                .setColor("GREEN")
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setFooter({
                    text: "Eclipse - Thank you for your support!",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.editReply({ 
                content: "An error occurred while processing your boost rewards. Please try again later.", 
                ephemeral: true 
            });
        }
    }
};

// Function to give boost rewards
async function giveBoostRewards(accountId, username) {
    try {
        const profile = await Profiles.findOne({ accountId: accountId });

        if (!profile) {
            return { success: false, error: "Profile not found" };
        }

        // Load cosmetics data
        const file = fs.readFileSync(path.join(__dirname, "../../../Config/DefaultProfiles/allathena.json"));
        const jsonFile = destr(file.toString());
        const items = jsonFile.items;

        // Find Rust Lord (CID_030) and Rust Bucket (BID_001)
        let rustLordKey = "";
        let rustBucketKey = "";
        let rustLordItem = null;
        let rustBucketItem = null;

        // Look for Rust Lord (CID_082_Athena_Commando_M_Scavenger)
        for (const key of Object.keys(items)) {
            if (key.includes("CID_082")) {
                rustLordKey = key;
                rustLordItem = items[key];
                break;
            }
        }

        // Look for Rust Bucket (BID_027_Scavenger)
        for (const key of Object.keys(items)) {
            if (key.includes("BID_027")) {
                rustBucketKey = key;
                rustBucketItem = items[key];
                break;
            }
        }

        // Fallback if items not found
        if (!rustLordItem) {
            rustLordKey = "AthenaCharacter:CID_082_Athena_Commando_M_Scavenger";
            rustLordItem = {
                "templateId": "AthenaCharacter:CID_082_Athena_Commando_M_Scavenger",
                "attributes": {
                    "max_level_bonus": 0,
                    "level": 1,
                    "item_seen": true,
                    "xp": 0,
                    "variants": [],
                    "favorite": false
                },
                "quantity": 1
            };
        }

        if (!rustBucketItem) {
            rustBucketKey = "AthenaBackpack:BID_027_Scavenger";
            rustBucketItem = {
                "templateId": "AthenaBackpack:BID_027_Scavenger",
                "attributes": {
                    "item_seen": true,
                    "variants": [],
                    "favorite": false
                },
                "quantity": 1
            };
        }

        const common_core = profile.profiles["common_core"];
        const athena = profile.profiles["athena"];

        // Add V-Bucks (500)
        const vbucks = 500;
        const currentVbucks = common_core.items['Currency:MtxPurchased'].quantity || 0;
        const newVbucksAmount = currentVbucks + vbucks;

        // Create loot list for gift box
        const lootList = [
            {
                "itemType": "Currency:MtxGiveaway",
                "itemGuid": "Currency:MtxGiveaway",
                "quantity": vbucks
            },
            {
                "itemType": rustLordItem.templateId,
                "itemGuid": rustLordItem.templateId,
                "quantity": 1
            },
            {
                "itemType": rustBucketItem.templateId,
                "itemGuid": rustBucketItem.templateId,
                "quantity": 1
            }
        ];

        // Create gift box
        const purchaseId = uuid.v4();
        common_core.items[purchaseId] = {
            "templateId": `GiftBox:GB_MakeGood`,
            "attributes": {
                "fromAccountId": `[${username}]`,
                "lootList": lootList,
                "params": {
                    "userMessage": `Thanks For Boosting Eclipse!`
                },
                "giftedOn": new Date().toISOString()
            },
            "quantity": 1
        };

        // Update V-Bucks
        common_core.items['Currency:MtxPurchased'].quantity = newVbucksAmount;

        // Add cosmetics to athena profile if they don't already exist
        if (!athena.items[rustLordKey]) {
            athena.items[rustLordKey] = rustLordItem;
        }
        if (!rustBucketKey || !athena.items[rustBucketKey]) {
            athena.items[rustBucketKey] = rustBucketItem;
        }

        // Update profile versions
        common_core.rvn += 1;
        common_core.commandRevision += 1;
        common_core.updated = new Date().toISOString();
        athena.rvn += 1;
        athena.commandRevision += 1;
        athena.updated = new Date().toISOString();

        // Save to database
        await Profiles.updateOne(
            { accountId: accountId },
            { 
                $set: { 
                    'profiles.common_core': common_core, 
                    'profiles.athena': athena,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': newVbucksAmount
                } 
            }
        );

        return { success: true };

    } catch (error) {
        console.error("Error giving boost rewards:", error);
        return { success: false, error: error.message };
    }
}

// Function to remove boost rewards
async function removeBoostRewards(accountId, username) {
    try {
        const profile = await Profiles.findOne({ accountId: accountId });

        if (!profile) {
            return { success: false, error: "Profile not found" };
        }

        const common_core = profile.profiles["common_core"];
        const athena = profile.profiles["athena"];

        // Remove V-Bucks (500)
        const vbucks = 500;
        const currentVbucks = common_core.items['Currency:MtxPurchased'].quantity || 0;
        const newVbucksAmount = Math.max(0, currentVbucks - vbucks); // Don't go below 0

        // Remove Rust Lord and Rust Bucket from athena profile
        const rustLordKey = "AthenaCharacter:CID_082_Athena_Commando_M_Scavenger";
        const rustBucketKey = "AthenaBackpack:BID_027_Scavenger";

        // Check if items exist and remove them
        let itemsRemoved = [];
        
        if (athena.items[rustLordKey]) {
            delete athena.items[rustLordKey];
            itemsRemoved.push("Rust Lord");
        }
        
        if (athena.items[rustBucketKey]) {
            delete athena.items[rustBucketKey];
            itemsRemoved.push("Rust Bucket");
        }

        // Update V-Bucks
        common_core.items['Currency:MtxPurchased'].quantity = newVbucksAmount;

        // Create a "removal" gift box to notify the user
        const purchaseId = uuid.v4();
        const lootList = [
            {
                "itemType": "Currency:MtxGiveaway",
                "itemGuid": "Currency:MtxGiveaway",
                "quantity": -vbucks // Negative to show removal
            }
        ];

        // Add items to loot list if they were removed
        if (itemsRemoved.includes("Rust Lord")) {
            lootList.push({
                "itemType": rustLordKey,
                "itemGuid": rustLordKey,
                "quantity": -1
            });
        }
        
        if (itemsRemoved.includes("Rust Bucket")) {
            lootList.push({
                "itemType": rustBucketKey,
                "itemGuid": rustBucketKey,
                "quantity": -1
            });
        }

        // Create notification gift box
        common_core.items[purchaseId] = {
            "templateId": `GiftBox:GB_MakeGood`,
            "attributes": {
                "fromAccountId": `[${username}]`,
                "lootList": lootList,
                "params": {
                    "userMessage": `Boost rewards removed - Boost again to get them back!`
                },
                "giftedOn": new Date().toISOString()
            },
            "quantity": 1
        };

        // Update profile versions
        common_core.rvn += 1;
        common_core.commandRevision += 1;
        common_core.updated = new Date().toISOString();
        athena.rvn += 1;
        athena.commandRevision += 1;
        athena.updated = new Date().toISOString();

        // Save to database
        await Profiles.updateOne(
            { accountId: accountId },
            { 
                $set: { 
                    'profiles.common_core': common_core, 
                    'profiles.athena': athena,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': newVbucksAmount
                } 
            }
        );

        return { success: true, itemsRemoved: itemsRemoved };

    } catch (error) {
        console.error("Error removing boost rewards:", error);
        return { success: false, error: error.message };
    }
}

// Export the functions so they can be used by the boost event handler
module.exports.giveBoostRewards = giveBoostRewards;
module.exports.removeBoostRewards = removeBoostR
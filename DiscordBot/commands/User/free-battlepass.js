const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "free-battlepass",
        description: "Check your free Battle Pass status and claim information",
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

        // Check if user already claimed free Battle Pass
        if (user.freeBattlePassClaimed) {
            const embed = new MessageEmbed()
                .setTitle("🎯 FREE BATTLE PASS STATUS")
                .setDescription(`**You have already claimed your free Battle Pass!**\n\n` +
                    `✅ **Status:** Claimed\n` +
                    `🎮 **How it works:** Complete any match to get the premium Battle Pass for free\n` +
                    `🎁 **Reward:** Full Season Battle Pass with all premium rewards\n\n` +
                    `Thank you for playing Eclipse!`)
                .setColor("GREEN")
                .setThumbnail("https://imgur.com/WT5gnsA.png")
                .setFooter({
                    text: "Eclipse - Free Battle Pass System",
                    iconURL: "Eclipse"
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // User hasn't claimed yet
        const embed = new MessageEmbed()
            .setTitle("🎯 FREE BATTLE PASS - AVAILABLE!")
            .setDescription(`**Complete one match to get the premium Battle Pass for free!**\n\n` +
                `🎮 **How to claim:**\n` +
                `1. Join any game mode (Solo, Duo, Squad)\n` +
                `2. Play until the match ends (win or lose doesn't matter)\n` +
                `3. The Battle Pass will be automatically unlocked!\n\n` +
                `🎁 **What you get:**\n` +
                `• Full premium Battle Pass for the current season\n` +
                `• Access to all premium rewards and tiers\n` +
                `• Battle Pass challenges and XP boosts\n\n` +
                `⚡ **Status:** Ready to claim after your next match!`)
            .setColor("GOLD")
            .setThumbnail("Eclipse")
            .setFooter({
                text: "Eclipse - Complete one match to claim!",
                iconURL: "https://imgur.com/WT5gnsA.png"
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });
    }
};
const Users = require('../../../model/user');
const config = require('../../../Config/config.json');
const { MessageEmbed } = require("discord.js");
const { giveBoostRewards } = require("../User/boost-rewards.js");

module.exports = {
    commandInfo: {
        name: "test-boost",
        description: "Test the boost rewards system (Admin only)",
        options: [
            {
                name: "user",
                description: "The user to test boost rewards for",
                required: true,
                type: 6
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const selectedUser = interaction.options.getUser('user');
        const selectedUserId = selectedUser.id;
        const user = await Users.findOne({ discordId: selectedUserId });

        if (!user) {
            return interaction.editReply({ content: "That user does not own an account", ephemeral: true });
        }

        // Reset boost rewards claimed status for testing
        await Users.updateOne(
            { accountId: user.accountId },
            { $set: { boostRewardsClaimed: false } }
        );

        // Give boost rewards
        const result = await giveBoostRewards(user.accountId, selectedUser.username);
        
        if (result.success) {
            // Mark user as having claimed boost rewards
            await Users.updateOne(
                { accountId: user.accountId },
                { $set: { boostRewardsClaimed: true } }
            );

            const embed = new MessageEmbed()
                .setTitle("🚀 TEST BOOST REWARDS SENT!")
                .setDescription(`**Test boost rewards sent to ${selectedUser.username}!**\n\n` +
                    `Rewards given:\n` +
                    `🎯 **Rust Lord** outfit\n` +
                    `🎒 **Rust Bucket** backbling\n` +
                    `💎 **500 V-Bucks**\n\n` +
                    `The user should check their in-game locker and gift box!`)
                .setColor("GREEN")
                .setThumbnail("https://imgur.com/WT5gnsA.png")
                .setFooter({
                    text: "Eclipse - Test successful!",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.editReply({ 
                content: `Error testing boost rewards: ${result.error}`, 
                ephemeral: true 
            });
        }
    }
};
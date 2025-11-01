const Users = require('../../../model/user');
const config = require('../../../Config/config.json');
const { MessageEmbed } = require("discord.js");
const { removeBoostRewards } = require("../User/boost-rewards.js");

module.exports = {
    commandInfo: {
        name: "remove-boost",
        description: "Remove boost rewards from a user (Admin only)",
        options: [
            {
                name: "user",
                description: "The user to remove boost rewards from",
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

        if (!user.boostRewardsClaimed) {
            return interaction.editReply({ content: "That user has not claimed boost rewards yet", ephemeral: true });
        }

        // Remove boost rewards
        const result = await removeBoostRewards(user.accountId, selectedUser.username);
        
        if (result.success) {
            // Mark user as not having claimed boost rewards
            await Users.updateOne(
                { accountId: user.accountId },
                { $set: { boostRewardsClaimed: false } }
            );

            const embed = new MessageEmbed()
                .setTitle("❌ BOOST REWARDS REMOVED!")
                .setDescription(`**Boost rewards removed from ${selectedUser.username}!**\n\n` +
                    `Rewards removed:\n` +
                    `🎯 **Rust Lord** outfit\n` +
                    `🎒 **Rust Bucket** backbling\n` +
                    `💎 **500 V-Bucks**\n\n` +
                    `Items removed: ${result.itemsRemoved.join(", ") || "None found"}`)
                .setColor("RED")
                .setThumbnail("https://imgur.com/WT5gnsA.png")
                .setFooter({
                    text: "Eclipse - Boost rewards removed!",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.editReply({ 
                content: `Error removing boost rewards: ${result.error}`, 
                ephemeral: true 
            });
        }
    }
};
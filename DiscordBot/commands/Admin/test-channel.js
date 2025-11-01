const config = require('../../../Config/config.json');
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "test-channel",
        description: "Test if the boost rewards channel is accessible (Admin only)",
        options: []
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const channelId = config.bBoostRewardsChannelId;
        
        if (!channelId || channelId.trim() === "") {
            return interaction.editReply({ 
                content: "❌ No boost rewards channel configured in config.json\n" +
                        "Please set `bBoostRewardsChannelId` to a valid channel ID.", 
                ephemeral: true 
            });
        }

        const channel = interaction.client.channels.cache.get(channelId);
        
        if (!channel) {
            return interaction.editReply({ 
                content: `❌ Channel not found!\n` +
                        `Channel ID: ${channelId}\n` +
                        `Make sure the bot has access to this channel and the ID is correct.`, 
                ephemeral: true 
            });
        }

        // Test sending a message to the channel
        try {
            const testEmbed = new MessageEmbed()
                .setTitle("🧪 CHANNEL TEST")
                .setDescription(`**Channel test successful!**\n\n` +
                    `This is a test message to verify that boost notifications will work.\n` +
                    `Channel: <#${channelId}>\n` +
                    `Bot has access: ✅`)
                .setColor("GREEN")
                .setFooter({
                    text: "Eclipse - Channel test",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();

            await channel.send({ embeds: [testEmbed] });

            await interaction.editReply({ 
                content: `✅ Channel test successful!\n` +
                        `Channel: <#${channelId}>\n` +
                        `Test message sent successfully. Boost notifications should work now.`, 
                ephemeral: true 
            });

        } catch (error) {
            await interaction.editReply({ 
                content: `❌ Failed to send message to channel!\n` +
                        `Channel: <#${channelId}>\n` +
                        `Error: ${error.message}\n` +
                        `Make sure the bot has permission to send messages in this channel.`, 
                ephemeral: true 
            });
        }
    }
};
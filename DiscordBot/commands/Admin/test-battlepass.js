const Users = require('../../../model/user');
const Profiles = require('../../../model/profiles');
const config = require('../../../Config/config.json');
const { MessageEmbed } = require("discord.js");

module.exports = {
    commandInfo: {
        name: "test-battlepass",
        description: "Test and debug the Free Battle Pass system",
        options: [
            {
                name: "user",
                description: "The user to test",
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
        const namedCounters = athenaProfile.stats.attributes.named_counters || {};
        const currentLevel = athenaProfile.stats.attributes.level || 1;
        const hasBattlePass = athenaProfile.stats.attributes.book_purchased === true;

        // Create detailed debug info
        let counterInfo = "**Named Counters:**\n";
        if (Object.keys(namedCounters).length === 0) {
            counterInfo += "No named counters found\n";
        } else {
            Object.keys(namedCounters).forEach(key => {
                counterInfo += `• ${key}: ${namedCounters[key].current_count}\n`;
            });
        }

        let embed = new MessageEmbed()
            .setColor("BLUE")
            .setTitle("🔧 Battle Pass System Debug")
            .setDescription(`Debug info for **${user.username}** (<@${selectedUserId}>)`)
            .addFields(
                { name: "👤 Username", value: user.username, inline: true },
                { name: "🆔 Account ID", value: user.accountId, inline: true },
                { name: "📊 Level", value: `${currentLevel}`, inline: true },
                { name: "🎮 Battle Pass", value: hasBattlePass ? "✅ Premium" : "❌ Free", inline: true },
                { name: "🎁 Free Claim Used", value: user.freeBattlePassClaimed ? "✅ Yes" : "❌ No", inline: true },
                { name: "🚫 Banned", value: user.banned ? "✅ Yes" : "❌ No", inline: true },
                { name: "📈 Counters", value: counterInfo.length > 1024 ? counterInfo.substring(0, 1020) + "..." : counterInfo, inline: false }
            )
            .setThumbnail("https://imgur.com/WT5gnsA.png")
            .setTimestamp()
            .setFooter({
                text: "Eclipse - Debug Panel",
                iconURL: "https://imgur.com/WT5gnsA.png"
            });

        // Add recommendations
        let recommendations = "";
        if (!user.freeBattlePassClaimed && !hasBattlePass) {
            if (currentLevel > 1) {
                recommendations += "✅ User should be eligible (level > 1)\n";
            }
            if (Object.keys(namedCounters).length > 0) {
                recommendations += "✅ User has named counters\n";
            }
            if (currentLevel === 1 && Object.keys(namedCounters).length === 0) {
                recommendations += "❌ User needs to play a match first\n";
            }
            recommendations += "\n**Next Steps:**\n";
            recommendations += "1. User should play a match\n";
            recommendations += "2. Check logs for trigger events\n";
            recommendations += "3. Use `/manage-free-battlepass action:grant` if needed";
        } else if (hasBattlePass) {
            recommendations += "✅ User already has Battle Pass";
        } else if (user.freeBattlePassClaimed) {
            recommendations += "ℹ️ User has already claimed free Battle Pass";
        }

        if (recommendations) {
            embed.addField("💡 Recommendations", recommendations, false);
        }

        interaction.editReply({ embeds: [embed], ephemeral: true });
    }
};
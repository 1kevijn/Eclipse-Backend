const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const User = require("../../../model/user.js");
const dayjs = require("dayjs");
const axios = require("axios");

module.exports = {
    commandInfo: {
        name: "daily-stats",
        description: "Shows your daily kills and wins, and allows you to claim V-Bucks."
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            if (!user) {
                return interaction.editReply({ 
                    content: "You do not have a registered account!", 
                    ephemeral: true 
                });
            }

            // Ensure daily stats are initialized
            const today = dayjs().format("YYYY-MM-DD");
            let needsSave = false;

            if (!user.dailyStats || user.dailyStats.date !== today) {
                user.dailyStats = {
                    date: today,
                    kills: 0,
                    wins: 0,
                    claimed: false
                };
                needsSave = true;
            }

            // Initialize vbucks field if it doesn't exist
            if (user.vbucks === undefined || user.vbucks === null) {
                user.vbucks = 0;
                needsSave = true;
            }

            if (needsSave) {
                await user.save();
            }

            // Calculate V-Bucks earned based on kills and wins
            const killVbucks = user.dailyStats.kills * 100;
            const winVbucks = user.dailyStats.wins * 500;
            const totalVbucksEarned = killVbucks + winVbucks;

            // Create the embed
            let embed = new MessageEmbed()
                .setColor("#56ff00")
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.avatarURL() })
                .setTitle("📊 Daily Stats")
                .addFields(
                    { name: "🎯 Kills", value: `${user.dailyStats.kills}`, inline: true },
                    { name: "🏆 Wins", value: `${user.dailyStats.wins}`, inline: true },
                    { name: "💰 Current V-Bucks", value: `${user.vbucks}`, inline: true },
                    { name: "💎 Kill Rewards", value: `${killVbucks} V-Bucks`, inline: true },
                    { name: "🏅 Win Rewards", value: `${winVbucks} V-Bucks`, inline: true },
                    { name: "🎁 Total Claimable", value: `${totalVbucksEarned} V-Bucks`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "Eclipse • Daily rewards reset at midnight" });

            // Check if the user has already claimed their V-Bucks for the day
            if (user.dailyStats.claimed) {
                embed.setColor("#ff0000")
                    .setDescription("❌ You have already claimed your V-Bucks for today! Come back tomorrow for new rewards.");
                
                return interaction.editReply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // Only show claim button if there are V-Bucks to claim
            if (totalVbucksEarned === 0) {
                embed.setColor("#ffaa00")
                    .setDescription("⚠️ No V-Bucks to claim yet! Get some kills or wins to earn rewards.");
                
                return interaction.editReply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // Create the claim button
            const row = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("claim-vbucks")
                    .setLabel(`Claim ${totalVbucksEarned} V-Bucks`)
                    .setStyle("SUCCESS")
                    .setEmoji("💰")
            );

            const message = await interaction.editReply({
                content: "Here are your daily stats:",
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

            // Collect button interaction
            const filter = (btnInteraction) => btnInteraction.user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ filter, time: 60000 });

            collector.on("collect", async (btnInteraction) => {
                if (btnInteraction.customId === "claim-vbucks") {
                    try {
                        // Refresh user data to prevent race conditions
                        const freshUser = await User.findOne({ discordId: interaction.user.id });
                        
                        if (!freshUser) {
                            return btnInteraction.reply({
                                content: "❌ User not found!",
                                ephemeral: true
                            });
                        }

                        if (freshUser.dailyStats.claimed) {
                            return btnInteraction.reply({
                                content: "❌ You have already claimed your V-Bucks for today!",
                                ephemeral: true
                            });
                        }

                        // Mark V-Bucks as claimed and update user's balance
                        freshUser.dailyStats.claimed = true;
                        freshUser.vbucks = (freshUser.vbucks || 0) + totalVbucksEarned;
                        await freshUser.save();

                        // Send API request to the backend to update in-game V-Bucks
                        try {
                            const apiKey = "eclipse12apikeylol";
                            const apiUrl = `http://194.163.132.225:4532/api/gfnogfn/vbucks?apikey=${apiKey}&username=${freshUser.username}&reason=DailyStats&amount=${totalVbucksEarned}`;

                            const response = await axios.get(apiUrl);
                            console.log("Successfully sent API request for V-Bucks claim:", response.data);
                        } catch (apiError) {
                            console.error("Failed to send API request:", apiError.message);
                            // Continue even if API fails, as we've already updated the database
                        }

                        // Update embed to show success
                        const successEmbed = new MessageEmbed()
                            .setColor("#00ff00")
                            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.avatarURL() })
                            .setTitle("✅ V-Bucks Claimed Successfully!")
                            .addFields(
                                { name: "🎯 Kills", value: `${freshUser.dailyStats.kills}`, inline: true },
                                { name: "🏆 Wins", value: `${freshUser.dailyStats.wins}`, inline: true },
                                { name: "💰 New V-Bucks Balance", value: `${freshUser.vbucks}`, inline: true },
                                { name: "🎁 Claimed Amount", value: `${totalVbucksEarned} V-Bucks`, inline: false }
                            )
                            .setDescription("💎 Your V-Bucks have been added to your account! Check your in-game balance.")
                            .setTimestamp()
                            .setFooter({ text: "Eclipse • Come back tomorrow for new rewards!" });

                        await btnInteraction.update({
                            content: "🎉 Congratulations!",
                            embeds: [successEmbed],
                            components: []
                        });

                        collector.stop();
                    } catch (error) {
                        console.error("Error during V-Bucks claim:", error);
                        await btnInteraction.reply({
                            content: "❌ An error occurred while claiming your V-Bucks. Please try again later.",
                            ephemeral: true
                        });
                    }
                }
            });

            collector.on("end", async (collected) => {
                if (collected.size === 0) {
                    // Disable the button if the interaction times out
                    try {
                        await interaction.editReply({
                            components: []
                        });
                    } catch (error) {
                        console.error("Error disabling components:", error);
                    }
                }
            });

        } catch (error) {
            console.error("Error in daily-stats command:", error);
            await interaction.editReply({
                content: "❌ An error occurred while fetching your daily stats. Please try again later.",
                ephemeral: true
            });
        }
    }
};

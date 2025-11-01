const { MessageEmbed } = require("discord.js");
const path = require("path");
const fs = require("fs");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const log = require("../../../structs/log.js");
const destr = require("destr");
const config = require('../../../Config/config.json');

// Pre-load allathena.json to avoid delays during command execution
let allItemsCache = null;
try {
    const fileContent = fs.readFileSync(path.join(__dirname, "../../../Config/DefaultProfiles/allathena.json"), 'utf8');
    allItemsCache = destr(fileContent);
    if (!allItemsCache || !allItemsCache.items) {
        log.error("allathena.json has invalid structure");
        allItemsCache = null;
    }
} catch (error) {
    log.error("Failed to pre-load allathena.json:", error);
}

module.exports = {
    commandInfo: {
        name: "addall",
        description: "Allows you to give a user all cosmetics. Note: This will reset all your lockers to default",
        options: [
            {
                name: "user",
                description: "The user you want to give the cosmetic to",
                required: true,
                type: 6
            }
        ]
    },
    execute: async (interaction) => {
        // Immediate interaction state check
        if (!interaction || !interaction.isApplicationCommand()) {
            log.error("Invalid interaction received");
            return;
        }

        let interactionHandled = false;
        
        try {
            // Check permissions first
            if (!config.moderators.includes(interaction.user.id)) {
                if (!interactionHandled) {
                    await interaction.reply({ content: "You do not have moderator permissions.", ephemeral: true });
                    interactionHandled = true;
                }
                return;
            }

            // Immediate defer to prevent timeout
            if (!interactionHandled) {
                await interaction.deferReply({ ephemeral: true });
                interactionHandled = true;
            }

            // Check if allathena.json is loaded
            if (!allItemsCache) {
                return await interaction.editReply({ content: "Cosmetics data is not available. Please check if allathena.json exists and is valid." });
            }

            const selectedUser = interaction.options.getUser('user');
            if (!selectedUser) {
                return await interaction.editReply({ content: "Invalid user specified." });
            }

            const selectedUserId = selectedUser.id;

            // Set a timeout for database operations (10 seconds)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database operation timeout')), 10000)
            );

            // Find target user with timeout
            const targetUser = await Promise.race([
                Users.findOne({ discordId: selectedUserId }),
                timeoutPromise
            ]);

            if (!targetUser) {
                return await interaction.editReply({ content: "That user does not own an account." });
            }

            // Check if profile exists with timeout
            const profile = await Promise.race([
                Profiles.findOne({ accountId: targetUser.accountId }),
                timeoutPromise
            ]);

            if (!profile) {
                return await interaction.editReply({ content: "That user does not have a profile." });
            }

            // Update profile with timeout
            const updatedProfile = await Promise.race([
                Profiles.findOneAndUpdate(
                    { accountId: targetUser.accountId }, 
                    { $set: { "profiles.athena.items": allItemsCache.items } }, 
                    { new: true }
                ),
                timeoutPromise
            ]);

            if (!updatedProfile) {
                return await interaction.editReply({ content: "Failed to update the profile." });
            }

            const embed = new MessageEmbed()
                .setTitle("Full Locker Added")
                .setDescription(`Successfully added all skins (Full Locker) to <@${selectedUserId}>`)
                .setColor("GREEN")
                .setFooter({
                    text: "Eclipse",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            log.error("An error occurred in addall command:", error.message || error);
            
            // Only attempt to reply if we haven't already handled the interaction
            if (!interactionHandled) {
                try {
                    await interaction.reply({ content: "An error occurred while processing the request.", ephemeral: true });
                } catch (replyError) {
                    log.error("Failed to send initial error message:", replyError.message);
                }
            } else {
                // Interaction was already deferred, use editReply
                try {
                    await interaction.editReply({ content: "An error occurred while processing the request." });
                } catch (editError) {
                    log.error("Failed to edit reply with error message:", editError.message);
                }
            }
        }
    }
};
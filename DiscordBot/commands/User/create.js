const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const functions = require("../../../structs/functions.js");
const crypto = require("crypto"); // Für Token-Generierung

module.exports = {
    commandInfo: {
        name: "create",
        description: "Creates an account on Eclipse.",
        options: [
            {
                name: "email",
                description: "Your email.",
                required: true,
                type: 3
            },
            {
                name: "username",
                description: "Your username.",
                required: true,
                type: 3
            },
            {
                name: "password",
                description: "Your password.",
                required: true,
                type: 3
            }
        ],
    },
    execute: async (interaction) => {
        try {
            await interaction.deferReply({ ephemeral: true });

            const { options } = interaction;

            const discordId = interaction.user.id;
            const email = options.get("email").value;
            const username = options.get("username").value;
            const password = options.get("password").value;

            const plainEmail = options.get('email').value;
            const plainUsername = options.get('username').value;

            const existingEmail = await User.findOne({ email: plainEmail });
            const existingUser = await User.findOne({ username: plainUsername });

            const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
            if (!emailFilter.test(email)) {
                return await interaction.editReply({ content: "You did not provide a valid email address!", ephemeral: true });
            }
            if (existingEmail) {
                return await interaction.editReply({ content: "Email is already in use, please choose another one.", ephemeral: true });
            }
            if (existingUser) {
                return await interaction.editReply({ content: "Username already exists. Please choose a different one.", ephemeral: true });
            }
            if (username.length >= 25) {
                return await interaction.editReply({ content: "Your username must be less than 25 characters long.", ephemeral: true });
            }
            if (username.length < 3) {
                return await interaction.editReply({ content: "Your username must be at least 3 characters long.", ephemeral: true });
            }
            if (password.length >= 128) {
                return await interaction.editReply({ content: "Your password must be less than 128 characters long.", ephemeral: true });
            }
            if (password.length < 4) {
                return await interaction.editReply({ content: "Your password must be at least 4 characters long.", ephemeral: true });
            }

            // Generieren eines zufälligen Tokens
            const token = generateToken();

            const resp = await functions.registerUser(discordId, username, email, password, token);
            
            let embed = new MessageEmbed()
                .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
                .setThumbnail(interaction.user.avatarURL({ format: 'png', dynamic: true, size: 256 }))
                .addFields({
                    name: "Message",
                    value: resp.status >= 400 ? "Failed to create account." : "Successfully created an account.",
                }, {
                    name: "Username",
                    value: username,
                }, {
                    name: "Discord Tag",
                    value: interaction.user.tag,
                })
                .setTimestamp()
                .setFooter({
                    text: "Eclipse",
                    iconURL: "https://imgur.com/WT5gnsA.png"
                });

            if (resp.status >= 400) {
                return await interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            // Try to send DM first, then handle the result
            try {
                await interaction.user.send({
                    content: `**Your account has been created successfully!**\n\nHere is your token: \`${token}\`\nPlease keep it safe.`
                });
                
                // DM was sent successfully
                await interaction.editReply({ content: "You successfully created an account! Check your DMs for your token.", ephemeral: true });
            } catch (dmError) {
                console.error("Error sending DM:", dmError);
                // DM failed, include token in the reply
                await interaction.editReply({ 
                    content: `You successfully created an account!\n\n**Your token:** \`${token}\`\n\nPlease keep it safe. (I couldn't send you a DM, so make sure to copy this token now!)`, 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error("Error in create command:", error);
            
            // Try to respond with error message if interaction hasn't been handled
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: "An error occurred while creating your account.", ephemeral: true });
                } else {
                    await interaction.editReply({ content: "An error occurred while creating your account." });
                }
            } catch (replyError) {
                console.error("Failed to send error message to Discord:", replyError);
            }
        }
    }
};

// Funktion zur Generierung eines zufälligen Tokens
function generateToken() {
    return crypto.randomBytes(32).toString("hex"); // Erzeugt einen 64-stelligen Hex-Token
}

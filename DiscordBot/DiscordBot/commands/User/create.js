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
            return interaction.editReply({ content: "You did not provide a valid email address!", ephemeral: true });
        }
        if (existingEmail) {
            return interaction.editReply({ content: "Email is already in use, please choose another one.", ephemeral: true });
        }
        if (existingUser) {
            return interaction.editReply({ content: "Username already exists. Please choose a different one.", ephemeral: true });
        }
        if (username.length >= 25) {
            return interaction.editReply({ content: "Your username must be less than 25 characters long.", ephemeral: true });
        }
        if (username.length < 3) {
            return interaction.editReply({ content: "Your username must be at least 3 characters long.", ephemeral: true });
        }
        if (password.length >= 128) {
            return interaction.editReply({ content: "Your password must be less than 128 characters long.", ephemeral: true });
        }
        if (password.length < 4) {
            return interaction.editReply({ content: "Your password must be at least 4 characters long.", ephemeral: true });
        }

        // Generieren eines zufälligen Tokens
        const token = generateToken();

        await functions.registerUser(discordId, username, email, password, token).then(resp => {
            let embed = new MessageEmbed()
                .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
                .setThumbnail(interaction.user.avatarURL({ format: 'png', dynamic: true, size: 256 }))
                .addFields({
                    name: "Message",
                    value: "Successfully created an account.",
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

            if (resp.status >= 400) return interaction.editReply({ embeds: [embed], ephemeral: true });

            // Sende den Embed in den Kanal
            (interaction.channel ? interaction.channel : interaction.user).send({ embeds: [embed] });

            // Sende den Token per DM an den Benutzer
            interaction.user.send({
                content: `**Your account has been created successfully!**\n\nHere is your token: \`${token}\`\nPlease keep it safe.`
            }).catch(err => {
                console.error("Error sending DM:", err);
                interaction.editReply({ content: "Account created, but I couldn't send you a DM. Please make sure your DMs are open.", ephemeral: true });
            });

            interaction.editReply({ content: "You successfully created an account!", ephemeral: true });
        });
    }
};

// Funktion zur Generierung eines zufälligen Tokens
function generateToken() {
    return crypto.randomBytes(32).toString("hex"); // Erzeugt einen 64-stelligen Hex-Token
}

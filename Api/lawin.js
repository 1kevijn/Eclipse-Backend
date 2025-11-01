const express = require('express');
const app = express();
const User = require('../model/user');
const log = require('../structs/log');

app.get('/api/lawin/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // Look for user using lowercase matching if your schema uses `username_lower`
        const user = await User.findOne({ username_lower: username.toLowerCase() });

        if (user) {
            return res.status(200).json({
                success: true,
                username: user.username,
                accountId: user.accountId // assuming this exists in the model
            });
        } else {
            log.backend(`Username not found: ${username}`);
            return res.status(404).json({
                success: false,
                message: 'Username not found.'
            });
        }
    } catch (error) {
        log.error(`Error retrieving account ID for ${req.params.username}: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
});

module.exports = app;

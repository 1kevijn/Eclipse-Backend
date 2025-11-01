const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        created: { type: Date, required: true },
        banned: { type: Boolean, default: false },
        discordId: { type: String, default: null, unique: true, sparse: true },
        accountId: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        username_lower: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        matchmakingId: { type: String, required: true, unique: true },
        isServer: { type: Boolean, default: false },
        currentSACCode: { type: String, default: null },
        token: { type: String, default: null },
        hwid: { type: String, default: null },
        vbucks: { type: Number, default: 0 },
        boostRewardsClaimed: { type: Boolean, default: false },
        freeBattlePassClaimed: { type: Boolean, default: false },
        dailyStats: {
            date: { type: String, default: null },
            kills: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            claimed: { type: Boolean, default: false }
        }
    },
    {
        collection: "users"
    }
);

const model = mongoose.model('UserSchema', UserSchema);

module.exports = model;

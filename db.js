const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const JSON_DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
    if (!fs.existsSync(JSON_DB_PATH)) {
        fs.writeFileSync(JSON_DB_PATH, JSON.stringify({}, null, 2));
        return {};
    }
    return JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
}

function saveDB(data) {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
}

// SQLite Veritabanı
const sqlitePath = path.join(__dirname, 'regear.sqlite');
const sqlite = new Database(sqlitePath);

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS regear_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        guild_id TEXT,
        location TEXT,
        image_url TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS giveaways (
        message_id TEXT PRIMARY KEY,
        channel_id TEXT,
        guild_id TEXT,
        prize TEXT,
        description TEXT,
        winner_count INTEGER,
        end_time INTEGER,
        participants TEXT DEFAULT '[]',
        status TEXT DEFAULT 'active'
    )
`);

function saveRegearLog(userId, guildId, location, imageUrl) {
    const stmt = sqlite.prepare('INSERT INTO regear_logs (user_id, guild_id, location, image_url) VALUES (?, ?, ?, ?)');
    stmt.run(userId, guildId, location, imageUrl);
}

function saveGiveaway(data) {
    const stmt = sqlite.prepare(`
        INSERT INTO giveaways (message_id, channel_id, guild_id, prize, description, winner_count, end_time, participants)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(data.message_id, data.channel_id, data.guild_id, data.prize, data.description, data.winner_count, data.end_time, JSON.stringify(data.participants || []));
}

function getGiveaway(messageId) {
    const row = sqlite.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
    if (row) {
        row.participants = JSON.parse(row.participants);
    }
    return row;
}

function updateGiveawayParticipants(messageId, participants) {
    const stmt = sqlite.prepare('UPDATE giveaways SET participants = ? WHERE message_id = ?');
    stmt.run(JSON.stringify(participants), messageId);
}

function getActiveGiveaways() {
    const rows = sqlite.prepare("SELECT * FROM giveaways WHERE status = ?").all('active');
    return rows.map(row => {
        row.participants = JSON.parse(row.participants);
        return row;
    });
}

function endGiveaway(messageId) {
    const stmt = sqlite.prepare("UPDATE giveaways SET status = ? WHERE message_id = ?");
    stmt.run('ended', messageId);
}

module.exports = { 
    loadDB, 
    saveDB, 
    saveRegearLog, 
    saveGiveaway, 
    getGiveaway, 
    updateGiveawayParticipants, 
    getActiveGiveaways, 
    endGiveaway 
};

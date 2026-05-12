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

function saveRegearLog(userId, guildId, location, imageUrl) {
    const stmt = sqlite.prepare('INSERT INTO regear_logs (user_id, guild_id, location, image_url) VALUES (?, ?, ?, ?)');
    stmt.run(userId, guildId, location, imageUrl);
}

module.exports = { loadDB, saveDB, saveRegearLog };

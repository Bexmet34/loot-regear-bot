const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');

require('dotenv').config();

const { handleLootSetup, handleLootButton, handleLootModalSubmit } = require('./lootSystem');
const { handleRegearSetup, handleRegearButton, handleRegearMarkPaid, handleRegearModalSubmit } = require('./regearSystem');

// ─── TOKEN & CLIENT ID ────────────────────────────────────────────────────────
const TOKEN     = process.env.TOKEN;
const CLIENT_ID = '1489979905306398791';

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
const commands = [
    new SlashCommandBuilder()
        .setName('loot')
        .setDescription('Loot sistemi ayarları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Loot kanallarını ayarla ve butonu gönder')
                .addChannelOption(opt =>
                    opt.setName('buton_kanal')
                        .setDescription('Loot hesaplama butonunun duracağı kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt.setName('log_kanal')
                        .setDescription('Hesaplama sonuçlarının düşeceği kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName('regear')
        .setDescription('Regear sistemi ayarları')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Regear kanallarını ayarla ve butonu gönder')
                .addChannelOption(opt =>
                    opt.setName('buton_kanal')
                        .setDescription('Regear taleplerinin başlatılacağı kanal (Buton burada duracak)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt.setName('log_kanal')
                        .setDescription('Regear taleplerinin iletileceği kanal')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('yetkili_rol')
                        .setDescription('Log kanalındaki Ödendi butonuna basabilecek rol')
                        .setRequired(true)
                )
        ),
];

// ─── REGISTER SLASH COMMANDS ──────────────────────────────────────────────────
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Slash komutları kaydediliyor...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands.map(c => c.toJSON()),
        });
        console.log('✅ Slash komutları kaydedildi!');
    } catch (err) {
        console.error('Komut kayıt hatası:', err.message);
    }
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('clientReady', async () => {
    console.log('Loot Hesap Makinesi Aktif!');
    await registerCommands();
});

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

    // ── Slash Commands ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'loot' && interaction.options.getSubcommand() === 'setup') {
            await handleLootSetup(interaction, client);
        }
        if (interaction.commandName === 'regear' && interaction.options.getSubcommand() === 'setup') {
            await handleRegearSetup(interaction, client);
        }
    }

    // ── Buton Interactions ─────────────────────────────────────────────────────
    if (interaction.isButton()) {
        if (interaction.customId === 'open_loot_modal') {
            await handleLootButton(interaction);
        }
        if (interaction.customId === 'open_regear_flow') {
            await handleRegearButton(interaction);
        }
        if (interaction.customId === 'regear_mark_paid') {
            await handleRegearMarkPaid(interaction);
        }
    }

    // ── Modal Submit Interactions ───────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'lootModal') {
            await handleLootModalSubmit(interaction, client);
        }
        if (interaction.customId === 'regearModal') {
            await handleRegearModalSubmit(interaction, client);
        }
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
client.login(TOKEN);

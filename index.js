const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
    ChannelType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

// ─── TOKEN & CLIENT ID ────────────────────────────────────────────────────────
const TOKEN     = process.env.TOKEN;
const CLIENT_ID = '1489979905306398791';

// ─── JSON DB ──────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
        return {};
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

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

// ─── SEND LOOT BUTTON ─────────────────────────────────────────────────────────
async function sendLootButton(channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('💰 Loot Hesaplama Sistemi')
        .setDescription('Loot dağıtımı hesaplamak için aşağıdaki butona tıklayın.')
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_loot_modal')
            .setLabel('Loot Hesapla')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚖️')
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('Buton mesajı gönderildi.');
}

// ─── SEND REGEAR BUTTON ───────────────────────────────────────────────────────
async function sendRegearButton(channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Regear Talep Sistemi')
        .setDescription(
            'Regear talebinde bulunmak için aşağıdaki butona tıklayın.\n' +
            'Nerede öldüğünüzü seçin ve ekran görüntünüzü gönderin.'
        )
        .setColor(0xE74C3C)
        .setFooter({ text: 'Regear Sistemi' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_regear_flow')
            .setLabel('Regear Talep Et')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🛡️')
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('Regear butonu gönderildi.');
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

        // /loot setup
        if (interaction.commandName === 'loot' && interaction.options.getSubcommand() === 'setup') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            const buttonChannel = interaction.options.getChannel('buton_kanal');
            const logChannel    = interaction.options.getChannel('log_kanal');

            const db = loadDB();
            if (!db[interaction.guildId]) db[interaction.guildId] = { loot: {}, regear: {} };
            db[interaction.guildId].loot = {
                buttonChannelId: buttonChannel.id,
                logChannelId: logChannel.id
            };
            saveDB(db);

            await sendLootButton(buttonChannel.id);

            return interaction.editReply({
                content:
                    `✅ **Loot sistemi kuruldu!**\n` +
                    `📌 Buton Kanalı: ${buttonChannel}\n` +
                    `📋 Log Kanalı: ${logChannel}`
            });
        }

        // /regear setup
        if (interaction.commandName === 'regear' && interaction.options.getSubcommand() === 'setup') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            const buttonChannel = interaction.options.getChannel('buton_kanal');
            const logChannel    = interaction.options.getChannel('log_kanal');
            const authRole      = interaction.options.getRole('yetkili_rol');

            const db = loadDB();
            if (!db[interaction.guildId]) db[interaction.guildId] = { loot: {}, regear: {} };
            db[interaction.guildId].regear = {
                buttonChannelId: buttonChannel.id,
                logChannelId: logChannel.id,
                authorizedRoleId: authRole.id
            };
            saveDB(db);

            await sendRegearButton(buttonChannel.id);

            return interaction.editReply({
                content:
                    `✅ **Regear sistemi kuruldu!**\n` +
                    `📌 Buton Kanalı: ${buttonChannel}\n` +
                    `📋 Log Kanalı: ${logChannel}\n` +
                    `👑 Yetkili Rol: ${authRole}`
            });
        }
    }

    // ── Buton Interactions ─────────────────────────────────────────────────────
    if (interaction.isButton()) {

        // ── Loot Modal Aç ──────────────────────────────────────────────────────
        if (interaction.customId === 'open_loot_modal') {
            const modal = new ModalBuilder()
                .setCustomId('lootModal')
                .setTitle('Loot Hesap Makinesi');

            modal.addComponents(
                // Alan 1: Toplam Loot (zorunlu)
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('loot_amount')
                        .setLabel('Toplam Loot Miktarı')
                        .setPlaceholder('100000000')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                // Alan 2: %100 alacak kişi sayısı (zorunlu)
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('full_count')
                        .setLabel('%100 Alacak Kişi Sayısı')
                        .setPlaceholder('10')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                // Alan 3: %50 alacak kişi sayısı (opsiyonel)
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('half_count')
                        .setLabel('%50 Alacak Kişi Sayısı *')
                        .setPlaceholder('3')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                // Alan 4: Özel yüzdelik oran (opsiyonel)
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ratio_percent')
                        .setLabel('Özel Oran % *')
                        .setPlaceholder('40')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                // Alan 5: Özel oranı alacak kişi sayısı (opsiyonel)
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('custom_count')
                        .setLabel('Özel Oranlı Kişi Sayısı *')
                        .setPlaceholder('2')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                )
            );

            return interaction.showModal(modal);
        }

        // ── Regear Flow Başlat ─────────────────────────────────────────────────
        if (interaction.customId === 'open_regear_flow') {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('regear_location_select')
                .setPlaceholder('📍 Nerede öldünüz?')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Solo').setDescription('Tek başına farm / avlanırken')
                        .setValue('Solo').setEmoji('⚔️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Content').setDescription('İçerik / dungeon / etkinlik')
                        .setValue('Content').setEmoji('🗺️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('ZvZ').setDescription('Guild savaşı / ZvZ')
                        .setValue('ZvZ').setEmoji('🏰'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Ganked').setDescription('Pusuya düşürüldünüz')
                        .setValue('Ganked').setEmoji('🗡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Diğer').setDescription('Diğer sebepler')
                        .setValue('Diğer').setEmoji('❓')
                );

            return interaction.reply({
                content: '🛡️ **Regear Talebi**\nLütfen nerede öldüğünüzü seçin:',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                flags: MessageFlags.Ephemeral,
            });
        }

        // ── Regear Ödendi Butonu ───────────────────────────────────────────────
        if (interaction.customId === 'regear_mark_paid') {
            const db = loadDB();
            const guildDb = db[interaction.guildId] || (db.regear ? db : { regear: {} });
            const authRoleId = guildDb.regear.authorizedRoleId;
            
            if (authRoleId && !interaction.member.roles.cache.has(authRoleId)) {
                return interaction.reply({
                    content: '❌ **Bu işlemi gerçekleştirmek için gerekli yetkiye sahip değilsiniz!**',
                    flags: MessageFlags.Ephemeral
                });
            }

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .setTitle('✅ Regear Ödendi')
                .setColor(0x2ECC71) // Yeşil
                .addFields({ name: '💸 Ödeyen Yetkili', value: `<@${interaction.user.id}>`, inline: true });

            await interaction.update({
                embeds: [updatedEmbed],
                components: [] // Butonu kaldır
            });
            return;
        }
    }

    // ── Select Menu: Regear Lokasyon ──────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'regear_location_select') {
        const location = interaction.values[0];

        await interaction.update({
            content:
                `✅ **${location}** seçildi!\n\n` +
                `📸 Lütfen şimdi bu kanala **ekran görüntünüzü** normal bir mesaj olarak gönderin.\n` +
                `*(Siz resmi gönderdikten hemen sonra mesajınız kanalı kirletmemesi için otomatik olarak silinecektir)*\n` +
                `⏰ 90 saniye süreniz var.`,
            components: [],
        });

        const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;

        try {
            const collected = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 90_000,
                errors: ['time'],
            });

            const msg        = collected.first();
            const attachment = msg.attachments.first();

            const db         = loadDB();
            const guildDb    = db[interaction.guildId] || (db.regear ? db : { regear: {} });
            const logChannel = client.channels.cache.get(guildDb.regear.logChannelId);

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Yeni Regear Talebi')
                    .setColor(0xE74C3C)
                    .addFields(
                        { name: '👤 Talep Eden', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                        { name: '📍 Öldüğü Yer', value: `**${location}**`, inline: true },
                        { name: '🕐 Tarih',       value: new Date().toLocaleString('tr-TR'),                   inline: true }
                    )
                    .setImage(`attachment://${attachment.name}`)
                    .setFooter({ text: 'Regear Sistemi' })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('regear_mark_paid')
                        .setLabel('Ödendi')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💸')
                );

                await logChannel.send({ 
                    embeds: [embed], 
                    files: [{ attachment: attachment.url, name: attachment.name }],
                    components: [actionRow] 
                });

                // Kanaldaki ekran görüntüsü mesajını anında siliyoruz
                await msg.delete().catch(() => {});

                // Sadece kişiye özel başarılı mesajı gönderiyoruz
                await interaction.followUp({
                    content: `✅ <@${interaction.user.id}> Regear talebiniz başarıyla iletildi!`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                // Kanaldaki ekran görüntüsü mesajını anında siliyoruz
                await msg.delete().catch(() => {});

                await interaction.followUp({
                    content: '❌ Hata: Log kanalı bulunamadı veya botun yetkisi yok! Lütfen yetkililere `/regear setup` yapmalarını söyleyin.',
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch {
            try {
                await interaction.followUp({
                    content: '⏰ Süre doldu! Regear talebiniz iptal edildi. Tekrar deneyin.',
                    flags: MessageFlags.Ephemeral,
                });
            } catch { /* interaction expired */ }
        }
    }

    // ── Modal Submit: Loot Hesaplama ──────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'lootModal') {
        let lootStr = interaction.fields.getTextInputValue('loot_amount').toLowerCase().trim();
        // Parse k, m, b suffixes (e.g., 10.5m -> 10500000)
        let L = 0;
        let multiplier = 1;
        if (lootStr.endsWith('k')) { multiplier = 1e3; lootStr = lootStr.slice(0, -1); }
        else if (lootStr.endsWith('m')) { multiplier = 1e6; lootStr = lootStr.slice(0, -1); }
        else if (lootStr.endsWith('b')) { multiplier = 1e9; lootStr = lootStr.slice(0, -1); }
        
        // Remove spaces and commas, then parse float
        lootStr = lootStr.replace(/,/g, '').replace(/ /g, '');
        L = parseFloat(lootStr) * multiplier;
        
        if (isNaN(L) || L <= 0) L = 0;

        const nFull   = parseInt(interaction.fields.getTextInputValue('full_count'))  || 0;
        const nHalf   = parseInt(interaction.fields.getTextInputValue('half_count'))  || 0;
        const pVal    = parseInt(interaction.fields.getTextInputValue('ratio_percent'))|| 0;
        const nCustom = parseInt(interaction.fields.getTextInputValue('custom_count')) || 0;

        const P          = pVal / 100;
        const totalUnits = (nFull * 1.0) + (nHalf * 0.5) + (nCustom * P);
        const basePay    = totalUnits > 0 ? L / totalUnits : 0;

        const fullAmount   = Math.floor(basePay);
        const halfAmount   = Math.floor(basePay * 0.5);
        const customAmount = Math.floor(basePay * P);

        const db         = loadDB();
        const guildDb    = db[interaction.guildId] || (db.loot ? db : { loot: {} });
        const logChannel = client.channels.cache.get(guildDb.loot.logChannelId);

        let desc = `💰 **Toplam Loot**\n**${L.toLocaleString()}** Silver\n\n`;
        desc += `✅ **%100 Pay (${nFull} Kişi)**\nKişi Başı: **${fullAmount.toLocaleString()}**\n\n`;

        if (nHalf > 0) {
            desc += `✨ **%50 Pay (${nHalf} Kişi)**\nKişi Başı: **${halfAmount.toLocaleString()}**\n\n`;
        }

        if (nCustom > 0 && pVal > 0) {
            desc += `✨ **%${pVal} Pay (${nCustom} Kişi)**\nKişi Başı: **${customAmount.toLocaleString()}**\n\n`;
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('⚖️ Dağıtım Hesaplandı')
            .setColor(0x2B2D31) // Dark theme color roughly matching discord
            .setDescription(desc.trim())
            .setFooter({ text: `Toplam Kişi Sayısı: ${nFull + nHalf + nCustom} | Hesaplayan: ${interaction.user.username}` })
            .setTimestamp();

        if (logChannel) {
            await logChannel.send({ embeds: [resultEmbed] });
            await interaction.reply({ content: 'Hesaplama başarıyla gönderildi!', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'Hata: Log kanalı bulunamadı! Önce `/loot setup` komutunu kullanın.', flags: MessageFlags.Ephemeral });
        }
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
client.login(TOKEN);

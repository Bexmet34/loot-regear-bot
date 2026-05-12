const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { loadDB, saveDB } = require('./db');

async function sendLootButton(client, channelId) {
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

async function handleLootSetup(interaction, client) {
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

    await sendLootButton(client, buttonChannel.id);

    return interaction.editReply({
        content:
            `✅ **Loot sistemi kuruldu!**\n` +
            `📌 Buton Kanalı: ${buttonChannel}\n` +
            `📋 Log Kanalı: ${logChannel}`
    });
}

async function handleLootButton(interaction) {
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

async function handleLootModalSubmit(interaction, client) {
    let lootStr = interaction.fields.getTextInputValue('loot_amount').toLowerCase().trim();
    // Parse k, m, b suffixes
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
        .setColor(0x2B2D31)
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

module.exports = {
    handleLootSetup,
    handleLootButton,
    handleLootModalSubmit
};

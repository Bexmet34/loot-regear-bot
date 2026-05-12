const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { loadDB, saveDB } = require('./db');

async function sendRegearButton(client, channelId) {
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

async function handleRegearSetup(interaction, client) {
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

    await sendRegearButton(client, buttonChannel.id);

    return interaction.editReply({
        content:
            `✅ **Regear sistemi kuruldu!**\n` +
            `📌 Buton Kanalı: ${buttonChannel}\n` +
            `📋 Log Kanalı: ${logChannel}\n` +
            `👑 Yetkili Rol: ${authRole}`
    });
}

async function handleRegearButton(interaction) {
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

async function handleRegearMarkPaid(interaction) {
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
}

async function handleRegearSelect(interaction, client) {
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

module.exports = {
    handleRegearSetup,
    handleRegearButton,
    handleRegearMarkPaid,
    handleRegearSelect
};

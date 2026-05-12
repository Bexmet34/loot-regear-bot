const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    MessageFlags 
} = require('discord.js');
const { loadDB, saveDB, saveRegearLog } = require('./db');

// Eğer FileUploadBuilder ve LabelBuilder varsa alalım (discord.js sürümüne bağlı olarak)
let FileUploadBuilder, LabelBuilder;
try {
    const djs = require('discord.js');
    FileUploadBuilder = djs.FileUploadBuilder;
    LabelBuilder = djs.LabelBuilder;
} catch (e) {}

async function sendRegearButton(client, channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Regear Talep Sistemi')
        .setDescription(
            'Regear talebinde bulunmak için aşağıdaki butona tıklayın.\n' +
            'Açılan pencerede nerede öldüğünüzü yazıp ekran görüntünüzü ekleyin.'
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
            `📌 Buton Kanalı: <#${buttonChannel.id}>\n` +
            `📋 Log Kanalı: <#${logChannel.id}>\n` +
            `👑 Yetkili Rol: <@&${authRole.id}>`
    });
}

async function handleRegearButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('regearModal')
        .setTitle('Regear Talep Formu');

    const locationInput = new TextInputBuilder()
        .setCustomId('regear_location')
        .setLabel('Nerede öldünüz? (Solo, ZvZ, vb.)')
        .setPlaceholder('Örn: ZvZ, Ganked, Content, Solo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(locationInput);

    if (FileUploadBuilder) {
        try {
            const fileUpload = new FileUploadBuilder()
                .setCustomId('regear_image')
                .setRequired(true);

            // Discord API LabelBuilder veya ActionRowBuilder istiyor olabilir.
            if (LabelBuilder) {
                const label = new LabelBuilder()
                    .setLabel('Lütfen ekran görüntünüzü yükleyin')
                    .setFileUploadComponent(fileUpload);
                modal.addComponents(row1, label);
            } else {
                const row2 = new ActionRowBuilder().addComponents(fileUpload);
                modal.addComponents(row1, row2);
            }
        } catch (e) {
            console.error("FileUploadBuilder hatası:", e);
            modal.addComponents(row1);
        }
    } else {
        modal.addComponents(row1);
    }

    return interaction.showModal(modal);
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

async function handleRegearModalSubmit(interaction, client) {
    const location = interaction.fields.getTextInputValue('regear_location');
    
    let attachment = null;
    
    // Resim Yükleme varsa alalım
    if (interaction.fields.getUploadedFiles) {
        try {
            const files = interaction.fields.getUploadedFiles('regear_image');
            if (files) {
                // Collection ise first() kullanılır, dizi ise [0]
                attachment = typeof files.first === 'function' ? files.first() : files[0];
            }
        } catch (e) {
            console.error("Dosya okunurken hata oluştu:", e);
        }
    }

    if (!attachment) {
        return interaction.reply({
            content: '❌ Ekran görüntüsü alınamadı! Lütfen tekrar deneyin.',
            flags: MessageFlags.Ephemeral
        });
    }

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

        // Kanala mesajı gönder
        const sentMessage = await logChannel.send({ 
            embeds: [embed], 
            files: [attachment],
            components: [actionRow] 
        });

        // Gönderilen mesajdaki resmin kalıcı URL'sini alalım
        let permanentUrl = "";
        if (sentMessage.attachments.size > 0) {
            permanentUrl = sentMessage.attachments.first().url;
        }

        // SQLite Veritabanına kaydet
        saveRegearLog(interaction.user.id, interaction.guildId, location, permanentUrl);

        await interaction.reply({
            content: `✅ <@${interaction.user.id}> Regear talebiniz başarıyla iletildi!`,
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: '❌ Hata: Log kanalı bulunamadı veya botun yetkisi yok! Lütfen yetkililere `/regear setup` yapmalarını söyleyin.',
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = {
    handleRegearSetup,
    handleRegearButton,
    handleRegearMarkPaid,
    handleRegearModalSubmit
};

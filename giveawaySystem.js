const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { 
    saveGiveaway, 
    getGiveaway, 
    updateGiveawayParticipants, 
    getActiveGiveaways, 
    endGiveaway 
} = require('./db');

/**
 * Süre metnini milisaniyeye çevirir (örn: 10m, 1h, 1d)
 */
function parseDuration(durationStr) {
    const regex = /^(\d+)([mhd])$/;
    const match = durationStr.toLowerCase().match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

/**
 * Çekiliş oluşturma modalını gösterir
 */
async function handleGiveawayCommand(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('giveawayModal')
        .setTitle('Çekiliş Oluştur');

    const prizeTitle = new TextInputBuilder()
        .setCustomId('prizeTitle')
        .setLabel('Ödül Başlığı')
        .setPlaceholder('Örn: 10M Gümüş')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const prizeDesc = new TextInputBuilder()
        .setCustomId('prizeDesc')
        .setLabel('Ödül Açıklaması')
        .setPlaceholder('Ödül hakkında detaylı bilgi...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const winnerCount = new TextInputBuilder()
        .setCustomId('winnerCount')
        .setLabel('Kazanacak Kişi Sayısı')
        .setPlaceholder('Örn: 1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const duration = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Süre (m, h, d)')
        .setPlaceholder('Örn: 30m, 2h, 1d')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(prizeTitle),
        new ActionRowBuilder().addComponents(prizeDesc),
        new ActionRowBuilder().addComponents(winnerCount),
        new ActionRowBuilder().addComponents(duration)
    );

    await interaction.showModal(modal);
}

/**
 * Modal gönderildiğinde çekilişi başlatır
 */
async function handleGiveawayModalSubmit(interaction) {
    const prize = interaction.fields.getTextInputValue('prizeTitle');
    const description = interaction.fields.getTextInputValue('prizeDesc');
    const winnersInput = interaction.fields.getTextInputValue('winnerCount');
    const durationInput = interaction.fields.getTextInputValue('duration');

    const winnerCount = parseInt(winnersInput);
    if (isNaN(winnerCount) || winnerCount <= 0) {
        return interaction.reply({ content: '❌ Geçersiz kazanan sayısı!', ephemeral: true });
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
        return interaction.reply({ content: '❌ Geçersiz süre formatı! (Örn: 10m, 1h, 1d)', ephemeral: true });
    }

    const endTime = Date.now() + durationMs;

    const embed = createGiveawayEmbed(prize, description, winnerCount, endTime, 0);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('Katıl')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    saveGiveaway({
        message_id: message.id,
        channel_id: interaction.channelId,
        guild_id: interaction.guildId,
        prize: prize,
        description: description,
        winner_count: winnerCount,
        end_time: endTime,
        participants: []
    });
}

/**
 * Çekiliş embedini oluşturur
 */
function createGiveawayEmbed(prize, description, winnerCount, endTime, participantCount) {
    const winChance = participantCount > 0 
        ? Math.min(100, (winnerCount / participantCount) * 100).toFixed(1) 
        : '100';

    return new EmbedBuilder()
        .setTitle(`🎉 Çekiliş: ${prize}`)
        .setDescription(description)
        .setColor('#5865F2')
        .addFields(
            { name: '🎁 Ödül', value: prize, inline: true },
            { name: '👥 Kazanan Sayısı', value: `${winnerCount}`, inline: true },
            { name: '⏱️ Bitiş', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
            { name: '📝 Katılımcılar', value: `${participantCount}`, inline: true },
            { name: '📈 Kazanma Şansı', value: `%${winChance}`, inline: true }
        )
        .setFooter({ text: 'Katılmak için aşağıdaki butona tıkla!' })
        .setTimestamp(endTime);
}

/**
 * Katıl butonuna basıldığında
 */
async function handleGiveawayJoin(interaction) {
    const giveaway = getGiveaway(interaction.message.id);
    if (!giveaway) return interaction.reply({ content: '❌ Bu çekiliş bulunamadı.', ephemeral: true });

    if (Date.now() > giveaway.end_time) {
        return interaction.reply({ content: '❌ Bu çekiliş zaten sona erdi.', ephemeral: true });
    }

    if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Zaten bu çekilişe katıldın!', ephemeral: true });
    }

    giveaway.participants.push(interaction.user.id);
    updateGiveawayParticipants(interaction.message.id, giveaway.participants);

    const updatedEmbed = createGiveawayEmbed(
        giveaway.prize, 
        giveaway.description, 
        giveaway.winner_count, 
        giveaway.end_time, 
        giveaway.participants.length
    );

    await interaction.message.edit({ embeds: [updatedEmbed] });
    await interaction.reply({ content: '✅ Çekilişe başarıyla katıldın! Bol şans.', ephemeral: true });
}

/**
 * Süresi dolan çekilişleri kontrol eder
 */
async function checkGiveaways(client) {
    const activeGiveaways = getActiveGiveaways();
    const now = Date.now();

    for (const gw of activeGiveaways) {
        if (now >= gw.end_time) {
            await finalizeGiveaway(client, gw);
        }
    }
}

/**
 * Çekilişi sonuçlandırır
 */
async function finalizeGiveaway(client, gw) {
    try {
        const channel = await client.channels.fetch(gw.channel_id);
        const message = await channel.messages.fetch(gw.message_id);

        endGiveaway(gw.message_id);

        if (gw.participants.length === 0) {
            console.log(`[Giveaway] ${gw.prize} için katılım olmadı, çekiliş iptal edildi.`);
            const embed = EmbedBuilder.from(message.embeds[0])
                .setColor('#ED4245')
                .setTitle(`🎉 Çekiliş Sona Erdi: ${gw.prize}`)
                .setFields([{ name: 'Sonuç', value: 'Yeterli katılım olmadığı için kazanan belirlenemedi.' }]);

            await message.edit({ embeds: [embed], components: [] });
            return;
        }

        const winners = [];
        const participants = [...gw.participants];
        const winnerCount = Math.min(gw.winner_count, participants.length);

        for (let i = 0; i < winnerCount; i++) {
            const randomIndex = Math.floor(Math.random() * participants.length);
            winners.push(participants.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

        const embed = EmbedBuilder.from(message.embeds[0])
            .setColor('#2ECC71')
            .setTitle(`🎉 Çekiliş Sona Erdi: ${gw.prize}`)
            .setDescription(`${gw.description}\n\n**Kazananlar:** ${winnerMentions}`)
            .setFields(
                { name: '🎁 Ödül', value: gw.prize, inline: true },
                { name: '👥 Katılımcı Sayısı', value: `${gw.participants.length}`, inline: true }
            );

        await message.edit({ embeds: [embed], components: [] });
        await channel.send({ 
            content: `🎊 Tebrikler ${winnerMentions}! **${gw.prize}** ödülünü kazandınız!` 
        });

        console.log(`[Giveaway] ${gw.prize} sonuçlandı. Kazananlar: ${winnerMentions}`);

    } catch (err) {
        if (err.code === 10008) {
            console.warn(`[Giveaway] Mesaj bulunamadı (silinmiş olabilir), çekiliş iptal edildi. ID: ${gw.message_id}`);
        } else if (err.code === 10003) {
            console.warn(`[Giveaway] Kanal bulunamadı, çekiliş iptal edildi. ID: ${gw.channel_id}`);
        } else {
            console.error('[Giveaway] Çekiliş sonuçlandırma hatası:', err);
        }
        endGiveaway(gw.message_id); 
    }
}

module.exports = {
    handleGiveawayCommand,
    handleGiveawayModalSubmit,
    handleGiveawayJoin,
    checkGiveaways
};

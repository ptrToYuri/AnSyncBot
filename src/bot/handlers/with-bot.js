'use strict';

const { Composer, Markup } = require('telegraf');
const { match } = require('@grammyjs/i18n');

const OpError = require(`${__base}/utils/op-error`);
const interchanges = require(`${__base}/controllers/interchanges`);
const subscriptions = require(`${__base}/controllers/subscriptions`);
const answerTypes = require(`${__base}/bot/answer-types`)

const chat = new Composer();

chat.start(async ctx => {
	if (ctx.startPayload.startsWith('info-'))
		return ctx.replyWithHTML(ctx.i18n.t(`withBot.${ctx.startPayload.substring('info-'.length)}`));
	else if (ctx.startPayload.startsWith('join-')) {
		const interchange = await interchanges.getByInvitation(
			ctx.startPayload.substring('join-'.length));

		if (!interchange) throw new OpError('errors.joinFailures.notInDb');
		if (interchange.status !== 'pending')
			throw new OpError(`errors.joinFailures.${interchange.status}`);

		console.log(`[WITH_BOT] Join succeed for ${ctx.from.id}, interchange id ${interchange._id}`)

		await answerTypes.find(el => el.name == interchange.answerType).prompt(ctx, interchange);
		ctx.session.interchange = interchange;

	}
	else return ctx.replyWithHTML(ctx.i18n.t(`withBot.start`, { me: ctx.botInfo.username }),
		Markup.inlineKeyboard([[Markup.button.switchToChat(ctx.i18n.t('withBot.tryInPrivate'), '')]]))
});

chat.hears(match('withBot.refuseButton'), async ctx => {
	await ctx.deleteMessage().catch(e => e);
	return ctx.replyWithHTML(ctx.i18n.t('withBot.qRefuseConfirmation'),
		Markup.inlineKeyboard([
			Markup.button.callback(ctx.i18n.t('basic.yes'), 'leave'),
			Markup.button.callback(ctx.i18n.t('basic.no'), 'do-not-leave')
		])
	)
});
chat.action('leave', async ctx => {
	await ctx.deleteMessage().catch(e => e);
	delete ctx.session.interchange;
	await ctx.replyWithHTML(ctx.i18n.t('withBot.youRefused'), Markup.removeKeyboard());
})
chat.action('do-not-leave', ctx => ctx.deleteMessage().catch(e => e));

chat.on('message', async ctx => {
	const interchange = ctx.session.interchange;

	const res = await answerTypes.find(el => el.name == interchange.answerType)
		.getResponse(ctx);
	if (!res) return;

	const waitingForPartner = await interchanges.submitAnswer(interchange._id, {
		userId: ctx.from.id,
		userFriendlyName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
		messageId: ctx.message.message_id,
		messageContent: res
	});
	delete ctx.session.interchange;
	if(waitingForPartner) await ctx.replyWithHTML(ctx.i18n.t('withBot.waitingForPartner'), Markup.removeKeyboard());
	else ctx.session.kbLazyRemoveId = String(interchange._id);
})

module.exports = chat;
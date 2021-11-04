'use strict';

const { Markup } = require('telegraf');
const chunk = require('chunk-text');

const median = require('compute-median');
const average = require('average')

module.exports = [

	{
		name: 'verbose',
		prompt: genericPrompt,
		getResponse: async ctx => {
			if (ctx.message.text) return ctx.message.text;
			else await ctx.replyWithHTML(ctx.i18n.t('errors.notText'));
		},
		sendResultsFromPrivate: genericForwardFromPrivate,
		sendResultsToGroup: async (interchange, bot, snCtx) => {
			const msg = await bot.telegram.sendMessage(interchange.groupData.id,
				snCtx.t('answerTypes.verbose.resToGroup', {
					creator: interchange.creatorFriendlyName,
					question: interchange.question.toUpperCase(),
					data: interchange.answers.map(el => `${el.userFriendlyName}: ${el.messageContent.replace()}`).join('\n\n')
				}),
				{
					parse_mode: 'HTML',
					reply_to_message_id: interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			)
			return msg.message_id;
		},
		explore: genericExplore
	},

	{
		name: 'score',
		prompt: async (ctx, interchange) => {
			await ctx.replyWithHTML(ctx.i18n.t(`answerTypes.score.promptMsg1`,
				{
					creator: ctx.chat.id == interchange.creatorId ?
						ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
					question: interchange.question
				}),
				Markup.keyboard([[ctx.i18n.t('withBot.refuseButton')]]).resize());
			await ctx.replyWithHTML(ctx.i18n.t(`answerTypes.score.promptMsg2`),
				Markup.inlineKeyboard(
					[
						[1, 3, 5, 7, 9].map(el => Markup.button.callback(el, `score-${el}`)),
						[2, 4, 6, 8, 10].map(el => Markup.button.callback(el, `score-${el}`))
					]))
		},
		getResponse: async ctx => {
			if (ctx.callbackQuery?.data?.startsWith('score-')) {
				const score = parseInt(ctx.callbackQuery.data.substring('score-'.length));
				if (!(score >= 1 && score <= 10)) {
					await ctx.replyWithHTML(ctx.i18n.t(`errors.notScore`));
					return score;
				}
				await ctx.editMessageReplyMarkup()
				return score;
			}
		},
		sendResultsFromPrivate: async (interchange, userId, bot, snCtx, shouldRemoveKb) => {
			await bot.telegram.sendMessage(userId, snCtx.t(`answerTypes.${interchange.answerType}.resFromPrivate`, {
				question: interchange.question.toUpperCase(),
				data: interchange.answers.map(el => `${el.userFriendlyName}: <b>${el.messageContent}/10</b>`).join('\n')
			}),
				{
					parse_mode: 'HTML',
					...(shouldRemoveKb ? Markup.removeKeyboard() : {})
				});
		},
		sendResultsToGroup: async (interchange, bot, snCtx) => {
			const msg = await bot.telegram.sendMessage(interchange.groupData.id,
				snCtx.t('answerTypes.verbose.resToGroup', {
					creator: interchange.creatorFriendlyName,
					question: interchange.question.toUpperCase(),
					data: interchange.answers.map(el => `${el.userFriendlyName}: ${el.messageContent}`).join('\n\n')
				}),
				{
					parse_mode: 'HTML',
					reply_to_message_id: interchange.groupData.promptMessageId,
					allow_sending_without_reply: true
				}
			)
			return msg.message_id;
		},
		explore: genericExplore
	},

	/*	{
			name: 'emoji'
		}	*/

]

async function genericPrompt(ctx, interchange) {
	return ctx.replyWithHTML(ctx.i18n.t(`answerTypes.${interchange.answerType}.prompt`,
		{
			creator: ctx.chat.id == interchange.creatorId ?
				ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
			question: interchange.question
		}),
		Markup.keyboard([[ctx.i18n.t('withBot.refuseButton')]]).resize())
}

async function genericExplore(ctx, interchange) {	// todo: chunk string
	return ctx.replyWithHTML(ctx.i18n.t(`answerTypes.${interchange.answerType}.explore`,
		{
			creator: ctx.chat.id == interchange.creatorId ?
				ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
			question: interchange.question.toUpperCase(),
			data: interchange.answers.map(el => `${el.userFriendlyName}: ${el.messageContent}`).join('\n\n')
		}),
		Markup.removeKeyboard())
}

async function genericForwardFromPrivate(interchange, userId, bot, snCtx, shouldRemoveKb) {
	await bot.telegram.sendMessage(userId, snCtx.t(`answerTypes.${interchange.answerType}.resFromPrivate`, {
		question: interchange.question.toUpperCase()
	}),
		{
			parse_mode: 'HTML',
			...(shouldRemoveKb ? Markup.removeKeyboard() : {})
		});
	for (let ans of interchange.answers)
		await bot.telegram.forwardMessage(userId, ans.userId, ans.messageId)
}
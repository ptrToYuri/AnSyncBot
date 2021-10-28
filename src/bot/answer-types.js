'use strict';

const { Markup } = require('telegraf');

module.exports = [
	{
		name: 'verbose',
		prompt: async (ctx, interchange) => {
			return ctx.replyWithHTML(ctx.i18n.t(`answerTypes.${interchange.answerType}.prompt`,
				{
					creator: ctx.chat.id == interchange.creatorId ?
						ctx.i18n.t('withBot.self') : interchange.creatorFriendlyName,
					question: interchange.question
				}),
				Markup.keyboard([[ctx.i18n.t('withBot.refuseButton')]]).resize())
		},
		getResponse: async ctx => {
			if (ctx.message.text) return ctx.message.text;
			else await ctx.replyWithHTML(ctx.i18n.t('errors.notText'));
		},
		sendResultsFromPrivate: async (interchange, userId, bot, t) => {
			await bot.telegram.sendMessage(userId,
				await t(userId, `answerTypes.${interchange.answerType}.resFromPrivate`, {
					question: interchange.question.toUpperCase()
				}), { parse_mode: 'HTML' });
			for (let ans of interchange.answers) {
				await bot.telegram.forwardMessage(userId, ans.userId, ans.messageId)
			}
		}
	},
	{
		name: 'score'
	},
	{
		name: 'emoji'
	}
]
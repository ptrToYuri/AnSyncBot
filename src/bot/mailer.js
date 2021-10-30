'use strict';

const { Markup } = require('telegraf');

const subscriptions = require(`${__base}/controllers/subscriptions`);
const answerTypes = require(`${__base}/bot/answer-types`);
const sessionNoCtx = require('./session-private-noctx')

const updates = subscriptions.events;

updates.on('success', async upd => {
	let failedIds = [];
	if (upd.interchange.fromPrivate) {
		for (let userId of upd.userIds) {
			console.log(`[MAILER] Notifying user ${userId} about success of ${upd.interchange._id}`)
			try {
				await answerTypes.find(el => el.name == upd.interchange.answerType)
					.sendResultsFromPrivate(
						upd.interchange,
						userId,
						bot,
						sessionNoCtx.t,
						((await sessionNoCtx.getSession(userId))?.kbLazyRemoveId == String(upd.interchange._id)))
			} catch (err) {
				failedIds.push(userId);
				console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${userId}`)
			}
		}
	}
	await subscriptions.deregisterExceptFor(upd.interchange._id, failedIds)
		.catch(err => console.log(`[MAILER] Failed to deregister updates: ${err.message}`));
});

updates.on('progress', async upd => {
	if (upd.interchange.fromPrivate) {
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about progress of ${upd.interchange._id}`)
		await bot.telegram.sendMessage(
			upd.userIds[0],
			await sessionNoCtx.t(upd.userIds[0], 'withBot.partnerAnswered'),
			{ parse_mode: 'HTML' }
		).catch(err => console.log(`[MAILER] Failed to report results: ${err.message}`))
	}
})

updates.on('failure', async upd => {
	let failedToReportIds = [];
	if (upd.interchange.fromPrivate) {
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about failure of ${upd.interchange._id}`)
		try {
			const session = await sessionNoCtx.getSession(upd.userIds[0]);
			await bot.telegram.sendMessage(
				upd.userIds[0],
				await sessionNoCtx.t(upd.userIds[0], 'withBot.partnerRefused',
					{ question: upd.interchange.question }, session),
				{
					parse_mode: 'HTML',
					...((session?.kbLazyRemoveId == String(upd.interchange._id))
						? Markup.removeKeyboard() : {})
				});
			if (session.interchangeId == String(upd.interchange._id)) delete session.interchangeId;
			await sessionNoCtx.updateSession(upd.userIds[0], session);
		} catch (err) {
			failedToReportIds.push(upd.userIds[0]);
			console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${upd.userIds[0]}`)
		}
	}
	await subscriptions.deregisterExceptFor(upd.interchange._id, failedToReportIds)
		.catch(err => console.log(`[MAILER] Failed to deregister updates: ${err.message}`));
})

var bot;
module.exports = {
	init: (_bot, _i18n) => { bot = _bot; return this }
}
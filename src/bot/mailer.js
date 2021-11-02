'use strict';

const { Markup } = require('telegraf');

const subscriptions = require(`${__base}/controllers/subscriptions`);
const answerTypes = require(`${__base}/bot/answer-types`);
const SessionNoCtx = require('./utils/session-noctx').SessionNoCtx;

const updates = subscriptions.events;

updates.on('success', async upd => {
	let failedIds = [];
	if (!upd.interchange.fromGroup) {
		for (let userId of upd.userIds) {
			console.log(`[MAILER] Notifying user ${userId} about success of ${upd.interchange._id}`)
			try {
				const snCtx = await SessionNoCtx.load(userId);
				await answerTypes.find(el => el.name == upd.interchange.answerType)
					.sendResultsFromPrivate(
						upd.interchange,
						userId,
						bot,
						snCtx,
						snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
			} catch (err) {
				failedIds.push(userId);
				console.log(`[MAILER] Failed to report results: ${err.message}. Queued user ${userId}`)
			}
		}
	}
	else {
		try {
			const grpSnCtx = await SessionNoCtx.load(upd.interchange.groupData.id, 'group-');
			if (grpSnCtx.session.bindings?.[upd.interchange._id]?.progressMsg)
				await bot.telegram.deleteMessage(upd.interchange.groupData.id, grpSnCtx.session.bindings[upd.interchange._id].progressMsg).catch(e => e);
			else console.log(`[MAILER] Failed to find progressMsg in session for group ${upd.interchange.groupData.id}`)

			const groupMsgId = await answerTypes.find(el => el.name == upd.interchange.answerType)
				.sendResultsToGroup(
					upd.interchange,
					bot,
					grpSnCtx);

			await bot.telegram.editMessageText(
				upd.interchange.groupData.id,
				upd.interchange.groupData.promptMessageId,
				null,
				grpSnCtx.t('group.promptEdited', {
					question: upd.interchange.question,
					link: upd.interchange.groupData.id > 0
						? grpSnCtx.t('group.promptEditedSupergroup', {
							href: `https://t.me/c/${upd.interchange.groupData.id}/${groupMsgId}`
						})
						: grpSnCtx.t('group.promptEditedGroup')
				}),
				{ parse_mode: 'HTML' }).catch(e => e)
		} catch (err) {
			console.log(err.stack)
		}
	}
	await subscriptions.deregisterExceptFor(upd.interchange._id, failedIds)
		.catch(err => console.log(`[MAILER] Failed to deregister updates: ${err.message}`));
});

updates.on('progress', async upd => {
	if (!upd.interchange.fromGroup) {
		const snCtx = await SessionNoCtx.load(upd.userIds[0]);
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about progress of ${upd.interchange._id}`)
		await bot.telegram.sendMessage(
			upd.userIds[0],
			snCtx.t('withBot.partnerAnswered'),
			{ parse_mode: 'HTML' }
		).catch(err => console.log(`[MAILER] Failed to report results: ${err.message}`))
	}
	else {
		console.log(`[MAILER] Notifying group ${upd.interchange.groupData} about progress of ${upd.interchange._id
			}, answered ${upd.interchange.answersCount}`);
		const grpSnCtx = await SessionNoCtx.load(upd.interchange.groupData.id, 'group-');
		if (grpSnCtx.session.bindings?.[upd.interchange._id]?.progressMsg)
			await bot.telegram.editMessageText(
				upd.interchange.groupData.id,
				grpSnCtx.session.bindings[upd.interchange._id].progressMsg,
				null,
				grpSnCtx.t('group.progress', {
					answered: upd.interchange.answersCount,
					maxAnswered: upd.interchange.maxParticipants,
					answeredPercentage: Math.round(
						upd.interchange.answersCount / upd.interchange.maxParticipants * 100),
					refusesLeft: upd.interchange.maxRefused - upd.interchange.refusedCount
				}),
				{ parse_mode: 'HTML' }
			);
		else
			console.log(`[MAILER] Failed to find progressMsg in session for group ${upd.interchange.groupData.id}`)
	}
})

updates.on('failure', async upd => {
	let failedToReportIds = [];
	if (!upd.interchange.fromGroup) {
		console.log(`[MAILER] Notifying user ${upd.userIds[0]} about failure of ${upd.interchange._id}`)
		try {
			const snCtx = await SessionNoCtx.load(upd.userIds[0]);
			await bot.telegram.sendMessage(
				upd.userIds[0],
				snCtx.t('withBot.partnerRefused', { question: upd.interchange.question }),
				{
					parse_mode: 'HTML',
					...((snCtx.session?.kbLazyRemoveId == String(upd.interchange._id))
						? Markup.removeKeyboard() : {})
				});
			if (snCtx.session.interchangeId == String(upd.interchange._id)) delete snCtx.session.interchangeId;
			await snCtx.save();
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
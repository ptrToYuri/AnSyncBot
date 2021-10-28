'use strict';

const updates = require(`${__base}/controllers/subscriptions`).events;
const answerTypes = require(`${__base}/bot/answer-types`);
const sessionNoCtx = require('./session-private-noctx')

updates.on('success', upd => {
	if (upd.interchange.fromPrivate) {
		upd.userIds.forEach(async userId => {
			answerTypes.find(el => el.name == upd.interchange.answerType)
				.sendResultsFromPrivate(
					upd.interchange,
					userId,
					bot,
					sessionNoCtx.t,
					((await sessionNoCtx.getSession(userId))?.kbLazyRemoveId == String(upd.interchange._id)))
				.catch(err => console.log(`[MAILER] Failed to report results: ${err.message}`))
		})
	}
})

var bot;
module.exports = {
	init: (_bot, _i18n) => { bot = _bot; return this }
}
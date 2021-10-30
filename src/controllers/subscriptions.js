'use strict';

const EventEmitter = require('events');

const subscriptions = require('../models/subscriptions');
// const interchanges = require('../controllers/interchanges') //lazy require because of circular dependency

const events = new EventEmitter();

async function register(userId, interchangeId, updateNames) {
	await subscriptions.findOneAndUpdate(
		{
			userId: userId,
			interchangeId: interchangeId
		},
		{
			$addToSet: { updates: updateNames }
		},
		{
			upsert: true
		}
	);
	console.log(`[SUBSCR] Registered updates ${updateNames} for ${userId
		}, interchange id ${interchangeId}`)
}

async function process(interchangeId, updateName, optObj = null, excludedUserIds = []) {
	console.log(`[SUBSCR] Processing update "${updateName}" for ${interchangeId
		}, excluded ${excludedUserIds.length ? excludedUserIds : 'none'}`);
	const matches = (await subscriptions.find({ interchangeId: interchangeId }))
		.filter(el => el.updates.includes(updateName))
		.filter(el => !excludedUserIds.includes(el.userId))
	if (matches.length)
		events.emit(updateName,
			{
				userIds: matches.map(el => el.userId),
				interchange: (updateName == 'success'
					? optObj || await require('../controllers/interchanges').getWithAnswers(interchangeId)
					: optObj || await require('../controllers/interchanges').get(interchangeId)
				)
			}
		)
}

async function deregisterExceptFor(interchangeId, excludedUserIds) {
	await subscriptions.deleteMany({
		interchangeId: interchangeId,
		userId: { $nin: excludedUserIds }
	});
	console.log(`[SUBSCR] Removing all updates for ${interchangeId
		} for users except ${excludedUserIds.length ? excludedUserIds : 'none'}`);
}

module.exports = {
	register, process, deregisterExceptFor,
	events
}
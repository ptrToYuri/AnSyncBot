'use strict';

const EventEmitter = require('events');

const subscriptions = require('../models/subscriptions');

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

async function process(interchangeId, updateName, optObj) {
	console.log(`[SUBSCR] Processing update "${updateName}" for ${interchangeId}`);
	const matches = (await subscriptions.find({ interchangeId: interchangeId }))
		.filter(el => el.updates.includes(updateName))
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

module.exports = { register, process, events }
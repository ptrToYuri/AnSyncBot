'use strict';

const Agenda = require('agenda');

const interchanges = require('../controllers/interchanges');

const agenda = new Agenda();
agenda.defaultLockLifetime(30 * 1000);

Agenda.prototype.createSession = function (db) {
	agenda.mongo(db);
	agenda.start();
}

agenda.on('ready', () => console.log('[SCHEDULER] Synced with database'));

agenda.define('invalidate-timed-out', interchanges.invalidateTimedOut);

agenda.on('ready', async () => {
	try {
		await agenda.every('*/20 * * * * *', 'invalidate-timed-out');
	} catch (err) {
		console.log(`[SCHEDULER] Init failed: ${err.message}`)
		process.exit(1);
	}
})

module.exports = agenda;
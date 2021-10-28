'use strict';

const config = require('config');
const mongoose = require('mongoose');

const tg = require('../bot');

; (async () => {
	try {
		await mongoose.connect(config.get('mongoUrl'));
		console.log('[DB] Connected to mongodb');
		tg.createSession(mongoose.connection.db);
	} catch (err) {
		console.log(`[DB] Failed to connect to mongodb: ${err.message}`);
		process.exit(1);
	}
})();

module.exports.close = async function () {
	mongoose.disconnect();
}
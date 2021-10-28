'use strict';

const sessions = require(`${__base}/models/tg-sessions`);

async function getSession(id) {
	return (await sessions.findOne({ key: `${id}:${id}` })).data;
}

async function updateSession(id, obj) {
	return sessions.updateOne({ key: `${id}:${id}` }, { data: obj });
}

async function t(id, key, extra = {}) {
	let lang;
	try {
		lang = (await getSession(id)).__language_code;
	} catch (err) {
		lang = i18n.config.defaultLanguage;
	};
	return i18n.t(lang, key, extra);
}

var i18n;
module.exports = {
	init: (bot, _i18n) => { i18n = _i18n; return this },
	getSession, updateSession, t
}
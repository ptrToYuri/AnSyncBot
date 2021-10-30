'use strict';

const config = require('config');
const { Scenes, Telegraf } = require('telegraf');

const bot = new Telegraf(config.get('botToken'));

async function launch() {
	try {
		await bot.launch();
		console.log(`[BOT] Telegram bot started.\nPlease make sure you have done the following:
1. /setinline -> enabled using Botfather
2. /setinlinefeedback -> enabled using BotFather`);
	} catch (err) {
		console.log(`[BOT] Bot failed to launch: ${err.message}`);
		process.exit(1);
	}
}

bot.catch(async (err, ctx) => {
	if (err.category == 'operational') {
		if (ctx.chat?.type && !ctx.inlineQuery)
			await ctx.replyWithHTML(ctx.i18n.t(err.message, err.args))
				.catch(err => console.log(`[BOT] Failed to report operror: ${err.message}`));
		console.log(`[OPERROR] ${err.message}`);
	}
	else {
		console.log(err.stack);
		await ctx.replyWithHTML(ctx.i18n.t('errors.somethingWentWrong'))
			.catch(err => console.log(`[BOT] Failed to report code error: ${err.message}`));
	}
})

const router = require('./middlewares/router');
const i18n = require('./middlewares/i18n');
const logger = new (require('telegraf-logger'))({
	format: '[%ui] [%ut] [%ct chat %ctl, @%cu, id %ci] [user @%u, %fn %ln, id %fi] %ust -> "%c"',
	contentLength: 200,
});

bot.use(require('telegraf-throttler').telegrafThrottler());
bot.use(logger.middleware());

module.exports.createSession = function (db) {
	bot.use(require('telegraf-session-mongodb').session(db,
		{ sessionKeyFn: ctx => { return `${ctx.from ? ctx.from.id : null}:${ctx.chat ? ctx.chat.id : null}` } }));
	bot.use(new Scenes.Stage([]).middleware());	// session does not work otherwise
	bot.use(i18n.middleware());
	bot.use(router);
	console.log('[BOT] Session created');
	launch();
}

require('./session-private-noctx').init(bot, i18n);
require('./mailer').init(bot, i18n);

module.exports.close = function (reason) {
	bot.stop(reason);
}
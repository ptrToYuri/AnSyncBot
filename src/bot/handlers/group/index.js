'use strict';

const { Composer, Markup } = require('telegraf');

const OpError = require(`${__base}/utils/op-error`);
const conf = require('./config')
const genSecret = require(`${__base}/utils/secret-generator`);
const answerTypes = require(`${__base}/bot/answer-types`);
const interchanges = require(`${__base}/controllers/interchanges`)

const chat = new Composer();

chat.use(conf.middleware);

chat.use(async ctx => {
	for (let answerType of answerTypes) {
		if (ctx.message?.text?.startsWith('/' + ctx.i18n.t(`answerTypes.${answerType.name}.command`)) &&		// scene reset via start command
			!(ctx.message.text.includes('@') && !ctx.message.text.includes(`@${ctx.me}`))) {

			const question = getQuestion(ctx);
			const qConfig = await conf.getConfig(ctx);
			const inviteSecret = genSecret();

			if (qConfig.maxParticipants < 2) throw new OpError('errors.notEnoughParticipants');

			const prompt = await ctx.replyWithHTML(ctx.i18n.t(`answerTypes.${answerType.name}.groupMessage`,
				{
					question: question,
					maxParticipants: qConfig.maxParticipants,
					maxRefused: qConfig.maxRefused,
					isAnonymous: qConfig.isAnonymous ? ctx.i18n.t('basic.yes') : ctx.i18n.t('basic.no'),
					validMin: qConfig.validMin || ctx.i18n.t('basic.no')
				}),
				Markup.inlineKeyboard([[
					Markup.button.url(ctx.i18n.t(`answerTypes.${answerType.name}.joinButton`),
						`t.me/${ctx.botInfo.username}?start=join-${inviteSecret}`)
				]]))

			const interchange = await interchanges.create({

				invitation: inviteSecret,

				maxParticipants: qConfig.maxParticipants,
				maxRefused: qConfig.maxRefused,
				isAnonymous: qConfig.isAnonymous,
				validUntil: qConfig.validMin ? new Date(new Date.getTime() + qConfig.validMin * 60000) : null,

				question: question,
				answerType: answerType.name,

				fromGroup: true,
				groupData: {
					id: ctx.chat.id,
					promptMessageId: prompt.message_id
				},

				creatorId: ctx.from.id,
				creatorFriendlyName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),

			});

			const progressMsg = await ctx.replyWithHTML(ctx.i18n.t('group.progress',
				{
					answered: 0,
					maxAnswered: qConfig.maxParticipants,
					answeredPercentage: 0,
					refusesLeft: qConfig.maxRefused
				}) + ctx.i18n.t('group.progressExtra'), {
				reply_to_message_id: prompt.message_id,
				allow_sending_without_reply: true
			})

			ctx.session.bindings = {
				...ctx.session.bindings, ...{
					[interchange._id]: {
						progressMsg: progressMsg.message_id,
						created: Date.now()
					}
				}
			}
		}
	};
})

function getQuestion(ctx) {
	const question = ctx.message.text
		.substring(ctx.message.entities[0].length + 1)
		.trim();
	if (!question) throw new OpError('errors.emptyCommand');
	return question;
}

chat.on('my_chat_member', ctx => {
	if (ctx.myChatMember.new_chat_member?.status == 'member' &&
		ctx.myChatMember.new_chat_member?.user?.id == ctx.botInfo.id)
		return ctx.replyWithHTML(ctx.i18n.t('group.welcome'));
})

module.exports = chat;
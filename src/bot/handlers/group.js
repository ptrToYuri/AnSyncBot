'use strict';

const { Composer } = require('telegraf');

const chat = new Composer();

chat.use(ctx => ctx.replyWithHTML('Пока не поддерживается'))

module.exports = chat;
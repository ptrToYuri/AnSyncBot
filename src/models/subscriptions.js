'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({

	interchangeId: { type: mongoose.Types.ObjectId, required: true },
	userId: { type: Number, required: true },
	updates: [{
		type: String, enum: ['progress', 'success', 'failure']
	}]

});

module.exports = mongoose.model('subscriptions', schema);
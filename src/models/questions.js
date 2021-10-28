'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({

	invitation: { type: String, required: true },
	fromPrivate: { type: Boolean, required: true },

	maxParticipants: { type: Number, required: true },
	maxRefused: { type: Number, default: 0 },

	question: { type: String, required: true },
	answerType: { type: String, required: true },

	creatorId: { type: Number, required: true },
	creatorFriendlyName: { type: String, required: true },

	status: { type: String, default: 'pending', enum: ['pending', 'success', 'failure'] },

	answers: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'answers'
	}],
	answersCount: { type: Number, default: 0 },
	refusedCount: { type: Number, default: 0 }

})

module.exports = mongoose.model('questions', schema);
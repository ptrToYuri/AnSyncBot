'use strict';

const mongoose = require('mongoose')

const OpError = require(`${__base}/utils/op-error`);
const questions = require('../models/questions')
const answers = require('../models/answers');
const subscriptions = require('../controllers/subscriptions')

async function create(params) {
	return questions.create(params);
}

async function getByInvitation(inv) {
	return questions.findOne({ invitation: inv }).select('-answers')
}

async function get(id) {
	return questions.findById(id).select('-answers')
}

async function getWithAnswers(id) {
	return questions.findById(id).populate('answers');
}

async function submitAnswer(interchangeId, params) {
	const session = await mongoose.startSession();
	console.log(`[INTCNG] Processing new answer for ${interchangeId}`);
	try {
		session.startTransaction();
		const aRes = await answers.updateOne(
			{
				userId: params.userId,
				interchangeId: interchangeId
			},
			{
				$setOnInsert: { ...params }
			},
			{ upsert: true }
		).session(session);
		if (!aRes.upsertedId) throw new OpError('errors.alreadyAnswered');
		console.log(`[INTCNG] Answer submitted to collection for ${interchangeId}`)

		const qRes = await questions.findOneAndUpdate(
			{ _id: interchangeId },
			[{
				$set: {
					answersCount: {
						$cond: {
							if: { $eq: ['$status', 'pending'] },
							then: { $add: ['$answersCount', 1] },
							else: '$answersCount'
						},
					},
					answers: {
						$cond: {
							if: { $eq: ['$status', 'pending'] },
							then: { $concatArrays: ['$answers', [aRes.upsertedId]] },
							else: '$answers'
						},
					},
					...(params.isRefusal ? {
						$cond: {
							if: { $lt: ['$answersCount', '$maxParticipants'] },
							then: { $add: ['$refusedCount', 1] },
							else: '$refusedCount'
						}
					} : {}),
					status: {
						$switch: {
							branches: [
								...params.isRefusal ? [
									{
										case: { $lte: [{ $subtract: ['$maxRefused', '$refusedCount'] }, 1] },
										then: 'failure'
									}] : [],
								{
									case: { $lte: [{ $subtract: ['$maxParticipants', '$answersCount'] }, 1] },
									then: 'success'
								}
							],
							default: 'pending'
						}
					}
				}
			}], { new: true }).session(session);

		let waitingForOthers = true;
		if (String(qRes.answers[qRes.answers.length - 1]) == aRes.upsertedId) {
			switch (qRes.status) {
				case 'pending':
					subscriptions.process(interchangeId, 'progress', qRes)
					break;
				case 'failure':
					subscriptions.process(interchangeId, qRes.status, qRes)
					waitingForOthers = false;
					break;
				case 'success':
					subscriptions.process(interchangeId, qRes.status);
					waitingForOthers = false;
					break;
			}
		}
		else throw new OpError('errors.alreadyEnded');
		console.log(`[INTCNG] Answer reflected in base question data for ${interchangeId}`)
		await session.commitTransaction();
		session.endSession();
		return waitingForOthers;
	} catch (err) {
		await session.abortTransaction();
		session.endSession();
		console.log(`[INTCNG] Transaction failed, reverting changes for ${interchangeId
			}. Reason: ${err.message}`);
		throw err;
	}
}

module.exports = {
	create,
	getByInvitation, get, getWithAnswers,
	submitAnswer
}
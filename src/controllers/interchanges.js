'use strict';

const mongoose = require('mongoose');
const shuffle = require('shuffle-array')

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
	const withAnswers = (await questions.findById(id).populate('answers')).toObject();
	withAnswers.answers = shuffle(withAnswers.answers)
	return withAnswers;
}

async function alreadyAnswered(interchangeId, userId) {
	return answers.exists({
		interchangeId: interchangeId,
		userId: userId
	})
}

async function submitAnswer(interchangeId, params, subscribeOnSuccess = true, isAnonymous = false) {
	if (isAnonymous) params.userFriendlyName = '???';

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
						refusedCount: {
							$cond: {
								if: { $eq: ['$status', 'pending'] },
								then: { $add: ['$refusedCount', 1] },
								else: '$refusedCount'
							}
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
			console.log(`[INTCNG] Answer reflected in base question data for ${interchangeId}`)
			if (subscribeOnSuccess)
				await subscriptions.register(params.userId, interchangeId, 'success');

			switch (qRes.status) {
				case 'pending':
					subscriptions.process(interchangeId, 'progress', qRes, qRes.fromGroup ? [] : [params.userId])
					break;
				case 'failure':
					subscriptions.process(interchangeId, qRes.status, qRes, qRes.fromGroup ? [] : [params.userId])
					waitingForOthers = false;
					break;
				case 'success':
					subscriptions.process(interchangeId, qRes.status);
					waitingForOthers = false;
					break;
			}
		}
		else throw new OpError('errors.alreadyEnded');
		await session.commitTransaction();
		session.endSession();
		return waitingForOthers
			? qRes.fromGroup
				? 'group'
				: 'private'
			: null;
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
	getByInvitation, get, getWithAnswers, alreadyAnswered,
	submitAnswer
}
const express = require('express');
const router = express.Router();

const costsCore = require('../core/costs');

/**
 * Router method for costs-endpoint
 * @param  {Object} req Express request object
 * @param  {Object} res Express response object
 */
router.get('/costs', function(req, res) {
	const userId = req.context.identity.cognitoIdentityId;

	costsCore.getCosts(userId).then(function(costs) {
		res.send(costs);
	}).catch(function(error) {
		res.send({ error : error });
	});
});
/**
 * Router function for one cost -endpoint
 * @param  {Object} req  Express request object
 * @param  {Object} res Express response object
 *
 */
router.get('/costs/:id', function(req, res) {
	const userId = req.context.identity.cognitoIdentityId;
	const costId = req.params.id;

	costsCore.getCostById(userId, costId).then(function(cost) {
		res.send(cost);
	}).catch(function(error){
		res.send(error);
	});
});
/**
 * Router function for adding new cost 
 * @param  {Object} req  Express request object
 * @param  {Object} res  Express response object
 */
router.post('/costs', function(req, res) {
	const userId = req.context.identity.cognitoIdentityId;
	let cost = req.body;

	costsCore.addNewCost(userId, cost).then(function(cost) {
		res.send(cost)
	}).catch(function(error) {
		res.send(error);
	});
});

/**
 * Router function for deleting the cost of the user by given id
 * @param  {Request} req  Express request object
 * @param  {Response} res Express response object
 */
router.delete('/costs/:id', function(req, res) {
	const userId = req.context.identity.cognitoIdentityId;
	const costId = req.params.id;
	const timeplaced = req.query.ts;

	costsCore.deleteCost(costId, userId, timeplaced).then(function(response) {
		res.send(response)
	}).catch(function(error){
		res.send(error);
	})
});

module.exports = router;
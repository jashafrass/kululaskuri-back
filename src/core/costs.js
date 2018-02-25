const uuid = require('uuid');
const async = require('async');
const dynamodb = require('../utils/dynamodb').getClient();

const core = {
	/**
	 * Calculates the total cost of the cost items
	 * @param  {Object} cost Cost object
	 * @return {Promise}  of calculation
	 */
	calculateTotalAmount : function(cost) {

		return new Promise((resolve, reject) => {
			let totalAmount = 0;

			// loop through the items
			async.each(cost.Items, function(item, callback) {
				// calculate the total amount by items
				totalAmount += item.Amount;
				// inform that everything was fine
				callback();
			}, function(err) {
				if(err) {
					reject(err);
				} else {
					// resolve the total amount
					resolve({ name : 'TotalAmount', value : totalAmount });
				}
			})
		});
	},

	convertDate : function(timeplaced) {
		return new Promise((resolve, reject) => {
			const date = new Date();
			date.setTime(timeplaced);

			const dateString = date.toLocaleDateString("fi-FI");

			resolve({ name : 'Datetime', value : dateString})
		});
	},

	analyzeCosts : function(costs) {

		return new Promise((resolve, reject) => {
			let costAnalysis = {
				shops : {

				},
				categories : {

				},
				costs : costs
			};

			// loop through costs
			async.each(costs, function(cost, callback) {

				if(costAnalysis.shops[cost.Shop] == undefined) {
					costAnalysis.shops[cost.Shop] = 0;
				}

				costAnalysis.shops[cost.Shop] += cost.TotalAmount;
				// loop through items
				async.each(cost.Items, function(costItem, itemCallback) {
					if(costAnalysis.categories[costItem.Category] == undefined) {
						costAnalysis.categories[costItem.Category] = 0;
					}

					costAnalysis.categories[costItem.Category] += costItem.Amount;
					itemCallback();
				}, function(err1) {
					callback();
				})
			}, function(err) {
				resolve(costAnalysis)
			})
		});
	},
	/**
	 * Gets costs by current user
	 * @param  {String} Amazon cognito userId 
	 * @return {Promise} Costs promise
	 */
	getCosts : function(userId) {
		const self = this;		
		// init the promise
		return new Promise((resolve, reject) => {
			// set up the query object
			
			// get the 30 days old costs if everything is fine and dandy
			const fromTime = new Date().getTime() - (1000 * 60 * 60 * 24 * 30);

			const params = {
				TableName: process.env.TABLE_NAME,
			    IndexName: "UserId-index",
			    KeyConditionExpression: "UserId = :v1",
			    FilterExpression: "Timeplaced >= :v2",
			    ExpressionAttributeValues: {
			        ":v1": userId,
			        ":v2": fromTime
			    },
			    ReturnConsumedCapacity: "TOTAL"
			}

			// and query from the database by given object
			dynamodb.query(params, function(err, data) {
				if(err) {
					reject({ "reason" : err });
				} else {
					// loop through the results
					async.each(data.Items, function(cost, callback) {
						// calculate the total amount
						self.modifyCostObject(cost).then(function() {
							callback();
						});
					// all the results were checked, let's inform
					}, function(err) {
						if(err) {
							reject(err);
						} else {
							console.log(data.Items);

							self.analyzeCosts(data.Items).then(function(items) {
								resolve( items );
							});
						}
					});
				}
			});
		});
	},
	/**
	 * Gets costs by given userId and costId
	 * @param  {String} userId Amazon cognito userId
	 * @param  {String} costId uuId
	 * @return {Promise} of cost
	 */
	getCostById : function(userId, costId) {

		const self = this;

		return new Promise((resolve, reject) => {
			const params = {
				TableName: process.env.TABLE_NAME,
			    KeyConditionExpression: "CostsId = :v1",
			    ExpressionAttributeValues: {
			        ":v1": costId
			    },
			    ReturnConsumedCapacity: "TOTAL"
			}

			dynamodb.query(params, function(err, data) {
				if(err) {
					reject(err);
				} else {
					if(data.Items.length > 0 && data.Items[0].UserId != userId) {
						reject({reason: 'No permission to read the cost ' + costId, status : 403});
					} else {
						self.modifyCostObject(data.Items[0]).then(function(cost) {
							resolve(cost);
						});
					}
				}
			});
		}); 
	},

	modifyCostObject : function(cost) {
		const self = this;

		// convert the objects
		return new Promise((resolve, reject) =>  {
			Promise.all([self.calculateTotalAmount(cost), self.convertDate(cost.Timeplaced)])
			.then(function(values) {
				async.each(values, function(item, callback) {
					cost[item.name] = item.value;
					callback();
				}, function(err) {
					resolve(cost);
				});
			});
		});

	},
	/**
	 * Adds new cost by userId and request body
	 * @param {String} userId Amazon cognito userId
	 * @param {Object} cost   Cost object, request body from the client
	 * @return {Promise} of new cost
	 */
	addNewCost : function(userId, cost) {
		return new Promise((resolve, reject) => {
			// if the timeplaced is not set, set the current timestamp			
			if(!cost.Timeplaced) {
				const time = new Date().getTime(); 
				cost.Timeplaced = time;
			}

			// generate cost id by uuid -algorithm
			const costsId = uuid.v4();

			// and set the costs id
			cost.CostsId = costsId;
			// and set the user id by given Amazon Cognito id
			cost.UserId = userId;


			// and set the params
			const params = {
				TableName : process.env.TABLE_NAME,
				Item : cost
			};

			// set the object to dynamo db
			dynamodb.put(params, function(err, data) {
				if(err) {
					reject(err);
				} else {
					resolve({"success" : true});
				}
			})
		});
	}

}

module.exports = core;
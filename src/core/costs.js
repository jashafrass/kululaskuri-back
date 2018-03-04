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

	/**
	 * Converts timeplaced to a date string
	 * @param  {Number} timeplaced Numeric timestamp
	 * @return {Promise}  
	 */
	convertDate : function(timeplaced) {
		return new Promise((resolve, reject) => {
			const date = new Date();
			date.setTime(timeplaced);
			
			const dateString = date.getDate() + "." + (date.getMonth() + 1) + "." + (1900 + date.getYear());

			resolve({ name : 'Datetime', value : dateString})
		});
	},

	/**
	 * {
	 * 	Items : [
	 * 		{ category : 'Ruoka/Tarvike/Juusto', amount : 50 }
	 * 	]
	 * }
	 *
	 * --> categories : [{
	 * 		"name" : "Ruoka",
	 * 		"amount" : 50
	 * 		"subcategories" : [{
	 * 			"name" : "Tarvike",
	 * 			"amount" : 50,
	 * 			"subcategories" : [{
	 * 				"name" : "Juusto",
	 * 				"amount" : 50
	 * 			}]
	 * 		}]
	 * }]
	 *
	 * {
	 * 	"Ruoka" : {
	 * 		
	 * 	}
	 * }
	 */

	/**
	 * Parses category string array to fancy tree
	 * @param  {[type]} item              [description]
	 * @param  {[type]} categoryPathArray [description]
	 * @return {[type]}                   [description]
	 */
	parseCategory : function(item, categoryPathArray) {
		const self = this;

		return new Promise((resolve, reject) => {
			const category = {};

			category.name = categoryPathArray[0];
			category.amount = item.Amount;

			// if there are categories coming up, set it
			if(categoryPathArray.length > 1) {
				// get sub category path array
				const subcategoryPathArray = categoryPathArray.slice(1);

				// and recurse
				self.parseCategory(item, subcategoryPathArray).then(function(subcategory) {
					category.subcategories = []
					category.subcategories.push(subcategory);
					resolve(category);
				});
			// we are done now
			} else {
				resolve(category);
			}
		})

	},

	/**
	 * Creates category tree from category array
	 * @param  {Array} categories Category array
	 * @return {Promise} fixed category tree
	 */
	createCategoryTree : function(categories, original) {

		const self = this;

		return new Promise((resolve, reject) => {

			const categoryTree = [];

			async.each(categories, function(category, callback) {
				let found = false;
				let foundcategory = {};

				async.each(categoryTree, function(resolvedcategory, itemCallback) {
					if(resolvedcategory.name == category.name) {
						found = true;
						resolvedcategory.amount += category.amount;
						if(!resolvedcategory.subcategories && category.subcategories) {
							resolvedcategory.subcategories = category.subcategories;
						} else if(resolvedcategory.subcategories && category.subcategories) {
							resolvedcategory.subcategories = resolvedcategory.subcategories.concat(category.subcategories);
						}
					}
					itemCallback();
				}, function() {
					if(!found) {
						categoryTree.push(category);
					}
					callback();
				});
			}, function() {
				// round robin for sub categories
				async.each(categoryTree, function(category, callback) {
					// if sub categories exist, resolve the tree for them
					if(category.subcategories) {
						// recurse
						self.createCategoryTree(category.subcategories).then(function(fixedsubcategories) {
							category.subcategories = fixedsubcategories;
							callback(); 
						})
					} else {
						callback();
					}

				}, function() {
					// sort the category tree by amount
					categoryTree.sort(function(a,b) {
						return b.amount - a.amount;
					});

					resolve(categoryTree);
				});

			});
		})

	

	},
	/**
	 * Resolve category hierarchy for costs
	 * @param  {[type]} costs [description]
	 * @return {[type]}       [description]
	 */
	resolveCategoryHierarchy : function(costs) {
		const self = this;

		return new Promise((resolve, reject) => {
			const categories = [];
			const parsedCategories = [];

			async.each(costs, function(cost, callback) {
				async.each(cost.Items, function(item, itemCallback) {
					// parse category from item
					self.parseCategory(item, item.Category.split("/")).then(function(category) {
						parsedCategories.push(category);
						itemCallback();
					});
				}, function() {
					callback();
				});
			}, function() {
				self.createCategoryTree(parsedCategories).then(function(categories) {
					let totalcost = 0.0; 

					async.each(categories, function(category, callback) {
						totalcost += category.amount;
						callback();
					}, function() {
						resolve({ categories: categories, totalAmount : totalcost });
					})
					
				})
			});
		})


	},

	resolveTotalShopCosts : function(costs) {
		return new Promise((resolve, reject) => {
			const costArray = [];

			async.each(costs, function(cost, callback) {
				let found = false;

				async.each(costArray, function(resolvedcost, itemCallback) {
					if(resolvedcost.name == cost.Shop) {
						found = true;
						resolvedcost.amount += cost.TotalAmount;
					}

					itemCallback();
				}, function() {
					if(!found) {
						costArray.push({ name: cost.Shop, amount : cost.TotalAmount})
					}

					callback();
				});
			}, function() {
				console.log("Resolved total costs");

				costArray.sort(function(a,b) {
					return b.amount - a.amount;
				});

				resolve(costArray);
			})
		})


	},
	/**
	 * Analyzes costs for shops and categories
	 * @param  {[type]} costs [description]
	 * @return {[type]}       [description]
	 */
	analyzeCosts : function(costs) {

		const self = this;

		return new Promise((resolve, reject) => {
			let costAnalysis = {
				costs : costs
			};

			Promise.all([self.resolveTotalShopCosts(costs), self.resolveCategoryHierarchy(costs)]).then(function(results) {
				costAnalysis.shops = results[0];
				costAnalysis.categories = results[1];

				resolve(costAnalysis);
			});
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
	deleteCost : function(costId, userId, timeplaced) {
		return new Promise((resolve, reject) => {
			const params = {
				TableName : process.env.TABLE_NAME,
				Key : {
					CostsId : costId,
					Timeplaced : Number(timeplaced)
				},
				ConditionExpression : 'UserId = :v1',
				ExpressionAttributeValues : {
					":v1" : userId
				}
			}

			// set the object to dynamo db
			dynamodb.delete(params, function(err, data) {
				if(err) {
					reject(err);
				} else {
					resolve({"success" : true});
				}
			})
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
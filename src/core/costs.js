const uuid = require('uuid');
const dynamodb = require('../utils/dynamodb').getClient();

const core = {
	/**
	 * Gets costs by current user
	 * @param  {String} Amazon cognito userId 
	 * @return {Promise} Costs promise
	 */
	getCosts : function(userId) {
		// init the promise
		return new Promise((resolve, reject) => {
			// set up the query object
			const params = {
				TableName: process.env.TABLE_NAME,
			    IndexName: "UserId-index",
			    KeyConditionExpression: "UserId = :v1",
			    ExpressionAttributeValues: {
			        ":v1": userId
			    },
			    ReturnConsumedCapacity: "TOTAL"
			}

			// and query from the database by given object
			dynamodb.query(params, function(err, data) {

				if(err) {
					reject({ "reason" : err });
				} else {
					resolve( data.Items );
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
				console.log(data);

				if(err) {
					reject(err);
				} else {
					resolve(data);
				}
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
			const costsId = uuid.v4();
			const time = new Date().getTime(); 

			cost.CostsId = costsId;
			cost.UserId = userId;
			cost.Timeplaced = time;

			const params = {
				TableName : process.env.TABLE_NAME,
				Item : cost
			};

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
const AWS = require('aws-sdk');

const dynamodb = {
	getClient : function() {
		let client = null;

		if(process.env.IS_OFFLINE) {
			client = new AWS.DynamoDB.DocumentClient({
				region : 'localhost',
				endpoint: 'http://localhost:8000'
			})
		} else {
			client = new AWS.DynamoDB.DocumentClient();
		}

		return client;
	}
}

module.exports = dynamodb;
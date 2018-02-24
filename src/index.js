const serverless = require('serverless-http');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const routes = require('./routes');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/', routes);

module.exports.handler = serverless(app, {
	request: function(request, event, context) {
		request.context = event.requestContext;
	}
});
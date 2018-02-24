var params = {
    TableName: 'Costs',
    KeySchema: [ // The type of of schema.  Must start with a HASH type, with an optional second RANGE.
        { // Required HASH type attribute
            AttributeName: 'CostsId',
            KeyType: 'HASH',
        }, {
            AttributeName: 'Timeplaced',
            KeyType: 'RANGE'
        }
    ],
    AttributeDefinitions: [ // The names and types of all primary and index key attributes only
        {
            AttributeName: 'CostsId',
            AttributeType: 'S'
        },
        {
            AttributeName : 'Timeplaced',
            AttributeType: 'N'
        },
        {
            AttributeName: 'UserId',
            AttributeType: 'S'
        }
        
        // ... more attributes ...
    ],
    ProvisionedThroughput: { // required provisioned throughput for the table
        ReadCapacityUnits: 5, 
        WriteCapacityUnits: 5, 
    },
    GlobalSecondaryIndexes: [ 
      { 
         IndexName: "UserId-index",
         KeySchema: [ 
            { 
               AttributeName: "UserId",
               KeyType: "HASH" 
            }
         ],
         Projection: { 
            ProjectionType: "ALL"
         },
         ProvisionedThroughput: { 
            ReadCapacityUnits: 2,
            WriteCapacityUnits: 2
        }
      }
   ]
};
dynamodb.createTable(params, function(err, data) {
    if (err) ppJson(err); // an error occurred
    else ppJson(data); // successful response
});
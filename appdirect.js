var DEBUG_MODE =	true;

var NS_ACCT = 'AVT';
if (process && process.env && process.env.NS)
{
	NS_ACCT = process.env.NS;
}

var PORT = 3000;
if (process && process.env && process.env.PORT)
{
	PORT = process.env.PORT;
}

var KEY =			process.env.CONSUMER_KEY;
var SECRET =		process.env.CONSUMER_SECRET;

var SUBSCRIPTION_CREATE =	'SUB_CREATE';
// TODO: Implement at a later date ???
//var SUBSCRIPTION_CHANGE =	'SUB_CHANGE';
var SUBSCRIPTION_CANCEL =	'SUB_CANCEL';

var SUBSCRIPTION_EVENT_SUITELET_URL = 'https://forms.na1.netsuite.com/app/site/hosting/scriptlet.nl?script=121&deploy=1&compid=TSTDRV1237842&h=b93d78611bf3b3176ae6';
if (NS_ACCT == 'WG')
{
	SUBSCRIPTION_EVENT_SUITELET_URL = 'https://forms.netsuite.com/app/site/hosting/scriptlet.nl?script=19&deploy=1&compid=663935&h=f2370a2458965f8fd368';
}		

var request = require('request');
var http = require('http');
var querystring = require('querystring');
var xmldoc = require('xmldoc');
var OAuth   = require('oauth-1.0a');
var oauth = OAuth(
		{
			consumer:
				{
					public:	KEY,
					secret:	SECRET
				},
			signature_method:	'HMAC-SHA1',
		});

function log(msg)
{
	if (DEBUG_MODE)
	{
		console.log(msg);
	}
}

function dumpObj(obj)
{
	for (var p in obj)
	{
		log(p + ' = ' + obj[p]);
	}
}

function extractXMLData(rootNode)
{
	var data = {  };

	var creatorNode = rootNode.descendantWithPath('creator');
	var companyNode = rootNode.descendantWithPath('payload.company');
	var orderNode = rootNode.descendantWithPath('payload.order');
	var accountNode = rootNode.descendantWithPath('payload.account');

	if (companyNode)
	{
		companyNode.eachChild(
			function (child, index, array)
			{
				var fieldName = 'cust_' + child.name;
				data[fieldName] = child.val;
			});
	}

	if (creatorNode)
	{
		creatorNode.eachChild(
			function (child, index, array)
			{
				var fieldName = 'cont_' + child.name;
				data[fieldName] = child.val;
			});
	}

	if (orderNode)
	{
		orderNode.eachChild(
			function (child, index, array)
			{
				if (child.name == 'item')
				{
					return;
				}

				var fieldName = 'ordr_' + child.name;
				data[fieldName] = child.val;
			});

		orderNode.eachChild(
			function (child, index, array)
			{
				if (child.name == 'item')
				{
					return;
				}

				var fieldName = 'ordr_' + child.name;
				data[fieldName] = child.val;
			});

		var itemNodes = orderNode.childrenNamed('item');
		for (var n = 0 ; n < itemNodes.length ; n++)
		{
			itemNodes[n].eachChild(
				function (child, index, array)
				{
					var fieldName = 'ordr_item_' + n + '_' + child.name;
					data[fieldName] = child.val;
				});
		}
	}

	if (accountNode)
	{
		accountNode.eachChild(
			function (child, index, array)
			{
				var fieldName = 'acct_' + child.name;
				data[fieldName] = child.val;
			});
	}

	return data;
}

function createSubscription(rawXML, serverResponse)
{
	var rootNode = new xmldoc.XmlDocument(rawXML);
	var postData = extractXMLData(rootNode);
	postData.eventType = SUBSCRIPTION_CREATE;
	postData.rawXML = rawXML;
	log('Extracted XML data:');
	dumpObj(postData);

	request(
		{
			url:		SUBSCRIPTION_EVENT_SUITELET_URL,
			method:		'POST',
			form:		postData,
			encoding:	null
		},

		function (error, httpResponse, body)
		{
			if (!httpResponse)
			{
				log('Request Error: ' + error);
			}
			else if (httpResponse.statusCode  != 200)
			{
				log('Server Error - Status Code: ' + httpResponse.statusCode);
			}
			else
			{
				log('XML returned from Netsuite:');
				log(body.toString());

				serverResponse.writeHead(200,
										 {
											 'Content-Length': Buffer.byteLength(body.toString()),
											 'Content-Type': 'text/xml; charset=UTF-8',
										 });
				serverResponse.write(body, 'utf8');
				serverResponse.end();
			}
		});
}

function cancelSubscription(rawXML, serverResponse)
{
	var rootNode = new xmldoc.XmlDocument(rawXML);
	var postData = extractXMLData(rootNode);
	postData.eventType = SUBSCRIPTION_CANCEL;
	postData.rawXML = rawXML;
	log('Extracted XML data:');
	dumpObj(postData);

	request(
		{
			url:		SUBSCRIPTION_EVENT_SUITELET_URL,
			method:		'POST',
			form:		postData,
			encoding:	null
		},

		function (error, httpResponse, body)
		{
			if (!httpResponse)
			{
				log('Request Error: ' + error);
			}
			else if (httpResponse.statusCode  != 200)
			{
				log('Server Error - Status Code: ' + httpResponse.statusCode);
			}
			else
			{
				log('XML returned from Netsuite:');
				log(body.toString());

				serverResponse.writeHead(200,
										 {
											 'Content-Length': Buffer.byteLength(body.toString()),
											 'Content-Type': 'text/xml; charset=UTF-8',
										 });
				serverResponse.write(body, 'utf8');
				serverResponse.end();
			}
		});
}

function processXML(xml, serverResponse)
{
	var type = '';

	if (xml && xml !== '')
	{
		var root = new xmldoc.XmlDocument(xml);
		type = root.valueWithPath('type');

		log('Event Type Received: ' + type);

		log('Passing Event request on to: ' + SUBSCRIPTION_EVENT_SUITELET_URL);

		switch (type)
		{
			case 'SUBSCRIPTION_ORDER':
				createSubscription(xml, serverResponse);
				break;

			case 'SUBSCRIPTION_CANCEL':
				cancelSubscription(xml, serverResponse);
				break;

			default:
				var def = new Buffer('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><result><success>false</success><errorCode>CONFIGURATION_ERROR</errorCode><message>Unsupported operation</message></result>');
				serverResponse.writeHead(200,
										 {
											 'Content-Length': Buffer.byteLength(body.toString()),
											 'Content-Type': 'text/xml; charset=UTF-8',
										 });
				serverResponse.write(body, 'utf8');
				serverResponse.end();
				break;
		}
	}
}

try
{
//	// Store intervalObjects for each request by eventId (from url) to make request handling function re-entrant
//	var timers = {  };

	http.createServer(
		function (input, output)
		{
			var now = new Date();
			console.log('--------------------------------------------------------------------------------');
			console.log('Date: ' + now.toString());
			console.log('Received notification of event');
			console.log('--------------------------------------------------------------------------------');

			var urlParts = input.url.split('?');
			var qry = urlParts[1];
			var params = querystring.parse(qry);
			var eventUrl = '';
//			var eventId;
			var requestData;

			if ((params.eventurl) && (params.eventurl !== ''))
			{
				eventUrl = params.eventurl;
				log('Event data at URL: "' + eventUrl + '"');

				var eventIdStart = eventUrl.indexOf('events');
				eventIdStart += ('events/'.length);
				eventId = eventUrl.substr(eventIdStart);
				log('Event ID: ' + eventId);

/*				timers[eventId] = setInterval(
					function ()
					{
					}, 15000);*/

				requestData =
					{
					url:		eventUrl,
					method:		'GET',
					data:		{  }
				};
				
				output.setTimeout(15000,
					function ()
					{
						output.write(' ');
						log('.');
					});

				request(
					{
						url:		requestData.url,
						method:		requestData.method,
						form:		requestData.data,
						headers:	oauth.toHeader(oauth.authorize(requestData))
					},
					function (error, httpResponse, body)
					{
						if (!httpResponse)
						{
							console.log(error);
						}
						else if (httpResponse.statusCode != 200)
						{
							console.log('Network or Server error - status Code: ' + httpResponse.statusCode);
							if (body)
							{
								log(body);
							}
						}
						else
						{
							log('Event XML Retrieved:\n');
							log(body);
							log('\n');

							// Now process the xml received
							//	var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><result><success>true</success><message>Successful</message></result>';

							processXML(body, output);

							//output.end('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><result><success>false</success><errorCode>USER_ALREADY_EXISTS</errorCode><message>Unable to create customer - customer already exists</message></result>');
						}
					});
			}
			else
			{
				log('No Event URL: skipping');
			}
		}).listen(PORT);

	console.log('App Direct Integration Web Service Started\n');
}
catch (e)
{
	console.log('App Direct Integration Web Service failed to start because:\n' + e.message);
}
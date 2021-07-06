'use strict';

const AWS = require('aws-sdk');
const route53 = new AWS.Route53();
const hash = require('hash.js')

function hostSecret(host) {
  return hash.sha256().update(process.env.apiSecret + host).digest('hex')
}

//sample: sls invoke -f hostSecret -d "home"
module.exports.hostSecret = async (data) => { 
  return hostSecret(data);
};

//sample fritz box config: https://4a5irq1h29.execute-api.eu-central-1.amazonaws.com/dev/dnsupdate?i=<ipaddr>&l=<username>&p=<pass>&h=<domain>
module.exports.dnsupdate = async (event) => { 
  const ip = event.queryStringParameters.i;
  const user = event.queryStringParameters.l;
  const password = event.queryStringParameters.p;
  const host = event.queryStringParameters.h;
  const hostPlusDomain = host + "." + process.env.domain;
  const operation = "user '" + user + "' updates '" + hostPlusDomain + "' to '" + ip + "': ";

  if (password != hostSecret(host)) {
    console.log(operation + "invalid host secret");
    return {
      statusCode: 403,
      body: "invalid host secret"
    };
  }

  try {
    await route53.changeResourceRecordSets({
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: hostPlusDomain,
              ResourceRecords: [
                {
                  Value: ip
                }
              ],
              TTL: 60,
              Type: "A"
            }
          }
        ],
        Comment: "Updated via dyndns by " + user
      },
      HostedZoneId: process.env.hostedZoneId
    }).promise();

    console.log(operation + "success");
    return {
      statusCode: 200,
      body: 'DNS record update success'
    };
  }
  catch (e) {
    console.log(operation + "failed", e);    
    return {
      statusCode: 500,
      body: 'DNS record update failed'
    };
  }
};

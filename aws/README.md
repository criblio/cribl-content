## Cribl Pipelines for various AWS logs 
----

**Supported Services**
- Amazon CloudFront - Access Logs are used to track access to CDN assets.
- AWS CloudTrail - Logs are used to track AWS account/API activity.
- Amazon VPC Flow - Logs capture network flow metadata in/out of VPCs.
- Elastic Load Balancing - Access Logs capture request information to load balancers

### Installing pipelines
---
**Option 1**. For each service of interest ($service) copy paste each `conf.json` file located in `pipelines/$service/conf.json` into Cribl UI. See [Pipelines Docs](https://docs.cribl.io/docs/pipelines) for more.

**Option 2**. For each service of interest ($service) copy each `conf.yml` file located in `pipelines/$service/conf.yml` in your Cribl's instance `local/cribl/pipelines/$service/`.

### What do pipelines do?
---

**VPC Flow Logs**: 
 - It has three Eval functions that set sourcetype and index and normalize field names (i.e. map original field names to Splunk CIM) and a Sampling function that samples ACCEPT events. Working with Evals functions:
   - To send to Splunk as-is (as delivered by Lambda), disable both Eval functions.
   - To send to Splunk with index-time CIM fields, enable the first Eval and disable the second. Index-time CIM fields allow for fast |tstats querying.
   - To send to Splunk only raw events and extract search-time CIM fields, disable the first Eval and enable the second.
 - **Note**: you can add more functions to this pipeline. E.g., you can Filter/Drop out events from certain IPs (e.g., known chatty IPs), or Sample on protocol numbers, or port numbers etc.

**CloudTrail Logs**: 
 - This pipeline starts with an Eval function that sets these events' sourcetype and index. Then, a Regex Extract function extracts _eventName and a Drop function that follows filters out read-only events, typically: Describe*, Get*, List*.

**ELB Logs**: 
 - Similar to VPC Flow logs, this pipeline has two Eval functions that set sourcetype and index and normalize field names and a Sampling function that samples events with both ELB and Backend ​status==200. Working with the Eval function:
   - To send to Splunk as-is (as delivered by Lambda), with index-time CIM fields, disable the Eval function. Index-time CIM fields allow for fast |tstats querying.
   - To send to Splunk only raw events and use search-time CIM fields, enable it.

**CloudFront Logs**: 
 - Similar to above, this pipeline has two Eval functions that set sourcetype and index and normalize field names and a Sampling function that samples events HTTP ​sc_status==200. Working with the Eval function:
   - To send to Splunk as-is (as delivered by Lambda), with index-time CIM fields, disable the Eval function. Index-time CIM fields allow for fast |tstats querying.
   - To send to Splunk only raw events and use search-time CIM fields, enable it.

### Installing Routes
---
Route filter and pipeline assocation is provided in the `pipelines/route.yml` file. 

`filter: origin == 'lambda:vpcflowlogs'` --> ` pipeline: aws-vpcflowlogs`
`filter: origin == 'lambda:elb'` --> ` pipeline: aws-elasticloadbalancing`
`filter: origin == 'lambda:cloudfrontlogs'` --> ` pipeline: aws-cloudfront`
`filter: origin == 'lambda:cloudtrail'` --> ` pipeline: aws-cloudtrail`

The field `origin` comes from the Lambda function (below).



### REQUIREMENTS
----
- Cribl instance with HTTPS input enabled 
- Serverless collector options: 
  - Cribl provided [Lambda function](https://github.com/criblio/cribl-integrations/tree/master/aws/src/lambda/S3EventsToCribl) 
  - [Cribl-S3-Log-Collector](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:496698360409:applications~Cribl-S3-Log-Collector) Serverless App 

- Cribl configured to send events to their final destination.

## License
---

MIT License (MIT)
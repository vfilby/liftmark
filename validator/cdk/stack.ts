import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LmwfValidatorStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
  // Cert for CloudFront. Lives in us-east-1 (CloudFront requirement); passed
  // in from the edge stack via CDK cross-region references.
  cloudFrontCertificate: acm.ICertificate;
}

export class LmwfValidatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LmwfValidatorStackProps) {
    super(scope, id, props);

    const { domainName, hostedZoneId, cloudFrontCertificate } = props;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'LiftMarkZone', {
      hostedZoneId,
      zoneName: 'liftmark.app',
    });

    // ── Lambda ──
    const validatorLogGroup = new logs.LogGroup(this, 'ValidatorLogGroup', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const validatorFn = new lambda.Function(this, 'ValidatorFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'dist')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      description: 'LMWF Validator — validates LiftMark Workout Format markdown',
      environment: {
        NODE_ENV: 'production',
      },
      logGroup: validatorLogGroup,
    });

    // ── HTTP API (no custom domain — CloudFront fronts all traffic now) ──
    const httpApi = new apigw.HttpApi(this, 'ValidatorApi', {
      apiName: 'lmwf-validator',
      description: 'LMWF Validator API (origin for CloudFront /validate)',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
    });

    const cfnStage = httpApi.defaultStage?.node.defaultChild as apigw.CfnStage;
    if (cfnStage) {
      cfnStage.defaultRouteSettings = {
        throttlingBurstLimit: 10,
        throttlingRateLimit: 5,
      };
    }

    httpApi.addRoutes({
      path: '/validate',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('ValidatorIntegration', validatorFn),
    });

    // Synth-time hostname for the HTTP API default execute-api URL. Used as
    // the CloudFront origin; we don't give API Gateway its own custom domain
    // anymore (CloudFront owns workoutformat.liftmark.app).
    const apiHostname = `${httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;

    // ── S3 bucket for static site ──
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `liftmark-workoutformat-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      // Retain on stack delete so a fat-fingered `cdk destroy` doesn't
      // nuke the site content. Uploads flow in via the Makefile, not CDK.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── CloudFront Function: resolve directory-index URLs ──
    // Astro emits /spec/index.html, /skill/SKILL.md, etc. With a plain S3
    // bucket behind OAC (not static-website hosting), CloudFront won't
    // auto-resolve `/spec` → `/spec/index.html`. Handle it here.
    const urlRewriteFunction = new cloudfront.Function(this, 'UrlRewriteFn', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else {
    var last = uri.split('/').pop();
    if (last.indexOf('.') === -1) {
      request.uri = uri + '/index.html';
    }
  }
  return request;
}
      `),
      comment: 'Rewrite /foo and /foo/ to /foo/index.html',
    });

    // ── CloudFront distribution ──
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);
    const apiOrigin = new origins.HttpOrigin(apiHostname, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      domainNames: [domainName],
      certificate: cloudFrontCertificate,
      // US + Europe edges. Swap to PRICE_CLASS_ALL for fully global.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      comment: 'LMWF — workoutformat.liftmark.app (S3 static + /validate origin)',
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
        functionAssociations: [{
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          function: urlRewriteFunction,
        }],
      },
      additionalBehaviors: {
        '/validate': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // API Gateway rejects requests where Host header doesn't match its
          // own domain — this policy forwards everything except Host.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: false,
        },
      },
    });

    // ── DNS: point apex of workoutformat.liftmark.app at CloudFront ──
    // Same logical ID as the pre-CloudFront ARecord so CFN updates in place
    // (target swaps from API Gateway alias to CloudFront alias) rather than
    // deleting and recreating the record.
    new route53.ARecord(this, 'ValidatorAliasRecord', {
      zone: hostedZone,
      recordName: domainName.split('.')[0],
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution),
      ),
    });
    new route53.AaaaRecord(this, 'ValidatorAliasRecordIpv6', {
      zone: hostedZone,
      recordName: domainName.split('.')[0],
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution),
      ),
    });

    // ── CloudWatch alarms (unchanged) ──
    new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      metric: validatorFn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Lambda error count > 5 in 5 minutes',
    });

    new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      metric: validatorFn.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p99' }),
      threshold: 5000,
      evaluationPeriods: 1,
      alarmDescription: 'Lambda p99 latency > 5s (timeout is 10s)',
    });

    new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
      metric: validatorFn.metricThrottles({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Lambda throttles detected',
    });

    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: httpApi.httpApiId },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'API Gateway 5xx count > 5 in 5 minutes',
    });

    // ── Outputs (Makefile reads these for deploy) ──
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${domainName}`,
      description: 'Public site URL (served via CloudFront)',
    });

    new cdk.CfnOutput(this, 'ValidateEndpoint', {
      value: `https://${domainName}/validate`,
      description: 'URL for the LMWF validation endpoint',
    });

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket for static site assets',
      exportName: 'LmwfSiteBucketName',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: 'LmwfDistributionId',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: validatorFn.functionName,
    });
  }
}

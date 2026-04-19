import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import * as path from 'path';

export class LmwfValidatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Domain setup ──
    const domainName = 'workoutformat.liftmark.app';
    const hostedZoneId = this.node.tryGetContext('hostedZoneId') ?? 'Z082094022DMVFBOHDGOE';
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'LiftMarkZone', {
      hostedZoneId,
      zoneName: 'liftmark.app',
    });

    // ACM certificate with DNS validation (auto-creates validation CNAME in Route 53)
    const certificate = new acm.Certificate(this, 'ValidatorCert', {
      domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Custom domain for API Gateway
    const customDomain = new apigw.DomainName(this, 'ValidatorDomain', {
      domainName,
      certificate,
    });

    // ── Lambda function ──
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

    // ── HTTP API ──
    const httpApi = new apigw.HttpApi(this, 'ValidatorApi', {
      apiName: 'lmwf-validator',
      description: 'LMWF Validator API',
      defaultDomainMapping: {
        domainName: customDomain,
      },
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
    });

    // Throttle the default stage
    const cfnStage = httpApi.defaultStage?.node.defaultChild as apigw.CfnStage;
    if (cfnStage) {
      cfnStage.defaultRouteSettings = {
        throttlingBurstLimit: 10,
        throttlingRateLimit: 5,
      };
    }

    // POST /validate route
    httpApi.addRoutes({
      path: '/validate',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('ValidatorIntegration', validatorFn),
    });

    // ── DNS record ──
    new route53.ARecord(this, 'ValidatorAliasRecord', {
      zone: hostedZone,
      recordName: domainName.split('.')[0],
      target: route53.RecordTarget.fromAlias(
        new route53targets.ApiGatewayv2DomainProperties(
          customDomain.regionalDomainName,
          customDomain.regionalHostedZoneId,
        ),
      ),
    });

    // ── CloudWatch Alarms ──
    // To receive notifications, add an SNS topic and wire it to these alarms
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

    // ── Outputs ──
    new cdk.CfnOutput(this, 'ValidateEndpoint', {
      value: `https://${domainName}/validate`,
      description: 'URL for the LMWF validation endpoint',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: validatorFn.functionName,
    });

    new cdk.CfnOutput(this, 'ApiGatewayEndpoint', {
      value: `${httpApi.url}validate`,
      description: 'Direct API Gateway URL (fallback)',
    });
  }
}

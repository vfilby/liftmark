#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LmwfEdgeStack } from './edge-stack';
import { LmwfValidatorStack } from './stack';

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? 'us-west-2';
const domainName = 'workoutformat.liftmark.app';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') ?? 'Z082094022DMVFBOHDGOE';

const commonTags = {
  Project: 'LiftMark',
  Service: 'lmwf-validator',
};

// Edge stack (us-east-1) — owns the CloudFront cert only.
const edge = new LmwfEdgeStack(app, 'LmwfEdgeStack', {
  description: 'LMWF edge certificates (us-east-1 for CloudFront)',
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
  tags: commonTags,
  domainName,
  hostedZoneId,
});

// Main stack — Lambda, HTTP API, S3, CloudFront, DNS, alarms.
new LmwfValidatorStack(app, 'LmwfValidatorStack', {
  description: 'LMWF Validator - LiftMark Workout Format validation service',
  env: { account, region },
  crossRegionReferences: true,
  tags: commonTags,
  domainName,
  hostedZoneId,
  cloudFrontCertificate: edge.certificate,
});

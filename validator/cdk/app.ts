#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LmwfValidatorStack } from './stack';

const app = new cdk.App();

new LmwfValidatorStack(app, 'LmwfValidatorStack', {
  description: 'LMWF Validator — LiftMark Workout Format validation service',
  env: {
    // Use the account/region from the CLI profile
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
  },
  tags: {
    Project: 'LiftMark',
    Service: 'lmwf-validator',
  },
});

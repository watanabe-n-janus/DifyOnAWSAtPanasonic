#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DifyOnAwsAtPanasonicStack } from '../lib/dify_on_aws_at_panasonic-stack';

const app = new cdk.App();
new DifyOnAwsAtPanasonicStack(app, 'DifyOnAwsAtPanasonicStack', {
  env: {
    region: 'us-west-2',
    // You need to explicitly set AWS account ID when you look up an existing VPC.
    // account: '123456789012'
  },
  // Allow access from the Internet. Narrow this down if you want further security.
  allowedCidrs: ['0.0.0.0/0'],
  // Set Dify version
  difyImageTag: '0.14.2',

  // uncomment the below for cheap configuration:
  // isRedisMultiAz: false,
  cheapVpc: true,
  // enableAuroraScalesToZero: true,

  // Please see DifyOnAwsStackProps in lib/dify-on-aws-stack.ts for all the available properties
});
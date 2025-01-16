#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DifyOnAwsAtPanasonicStack } from "../lib/dify_on_aws_at_panasonic-stack";

const app = new cdk.App();
new DifyOnAwsAtPanasonicStack(app, "DifyOnAwsAtPanasonicStack", {
  env: {
    region: "ap-northeast-1",
    // You need to explicitly set AWS account ID when you look up an existing VPC.
    account: "nnnnnnnnnnn",
  },
  // Allow access from the Internet. Narrow this down if you want further security.
  allowedCidrs: ["0.0.0.0/0"],
  // Set Dify version(動作確認済みバージョン、コメントアウトすると最新版で起動)
  difyImageTag: "0.14.2",

  /**
   * 本番環境では
   *
   * - isRedisMultiAz: true
   * - enableAuroraScalesToZero: false
   * - cheapVpc: false
   *
   **/
  isRedisMultiAz: false,
  cheapVpc: true,
  enableAuroraScalesToZero: false,
  //hostedZoneIdとdomainNameはセットで指定
  hostedZoneId: "xxxxxxxxxxx", // PanasonicのRoute53のHosted Zone ID
  domainName: "yyyyyyyyy",
  subDomainName: "zzzzzzzz",

  // Please see DifyOnAwsStackProps in lib/dify-on-aws-stack.ts for all the available properties
});

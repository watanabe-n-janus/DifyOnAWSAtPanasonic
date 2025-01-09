import * as cdk from "aws-cdk-lib";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { Redis } from "./constructs/redis";
import { Alb } from "./constructs/alb";
import { Postgres } from "./constructs/postgres";
import { WebService } from "./constructs/dify-services/web";
import { WorkerService } from "./constructs/dify-services/worker";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { ApiService } from "./constructs/dify-services/api";
import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";

import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  NatProvider,
  SubnetType,
  IVpc,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
interface DifyOnAwsStackProps extends cdk.StackProps {
  /**
   * The IP address ranges in CIDR notation that have access to the app.
   * @example ['1.1.1.1/30']
   */
  allowedCidrs: string[];
  /**
   * The image tag to deploy Dify container images (api=worker and web).
   * The images are pulled from [here](https://hub.docker.com/u/langgenius).
   *
   * It is recommended to set this to a fixed version,
   * because otherwise an unexpected version is pulled on a ECS service's scaling activity.
   * @default "latest"
   */
  difyImageTag?: string;
  /**
   * The image tag to deploy the Dify sandbox container image.
   * The image is pulled from [here](https://hub.docker.com/r/langgenius/dify-sandbox/tags).
   *
   * @default "latest"
   */
  difySandboxImageTag?: string;
  /**
   * If true, Dify sandbox allows any system calls when executing code.
   * Do NOT set this property if you are not sure code executed in the sandbox
   * can be trusted or not.
   *
   * @default false
   */
  allowAnySyscalls?: boolean;
  /**
   * Use t4g.nano NAT instances instead of NAT Gateway.
   * Ignored when you import an existing VPC.
   * @default false
   */
  cheapVpc?: boolean;
  /**
   * If true, the ElastiCache Redis cluster is deployed to multiple AZs for fault tolerance.
   * It is generally recommended to enable this, but you can disable it to minimize AWS cost.
   * @default true
   */
  isRedisMultiAz?: boolean;
  /**
   * The domain name you use for Dify's service URL.
   * You must own a Route53 public hosted zone for the domain in your account.
   * @default No custom domain is used.
   */
  domainName?: string;

  /**
   * The ID of Route53 hosted zone for the domain.
   * @default No custom domain is used.
   */
  hostedZoneId?: string;
  /**
   *
   * @default false
   */
  enableAuroraScalesToZero?: boolean;
  /**
   * サブドメイン名
   */
  subDomainName?: string;
}

export class DifyOnAwsAtPanasonicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DifyOnAwsStackProps) {
    super(scope, id, props);
    const {
      difyImageTag: imageTag = "latest",
      difySandboxImageTag: sandboxImageTag = "latest",
      allowAnySyscalls = false,
    } = props;
    // Create a VPC
    let vpc: IVpc;
    vpc = new Vpc(this, "Vpc", {
      ...(props.cheapVpc
        ? {
            natGatewayProvider: NatProvider.instanceV2({
              instanceType: InstanceType.of(
                InstanceClass.T4G,
                InstanceSize.NANO
              ),
            }),
            natGateways: 1,
          }
        : {}),
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: "Public",
          // NAT instance does not work when this set to false.
          // mapPublicIpOnLaunch: false,
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: "Private",
        },
      ],
    });

    if ((props.hostedZoneId != null) !== (props.domainName != null)) {
      if (props.subDomainName == null) {
        throw new Error(
          `You have to set both hostedZoneId and domainName! Or leave both blank.`
        );
      }
    }

    const hostedZone =
      props.domainName && props.hostedZoneId
        ? PublicHostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            zoneName: props.domainName,
            hostedZoneId: props.hostedZoneId,
          })
        : undefined;

    // ECS Cluster
    const cluster = new Cluster(this, "Cluster", {
      vpc,
      containerInsights: true,
    });

    const redis = new Redis(this, "Redis", {
      vpc,
      multiAz: props.isRedisMultiAz ?? true,
    });

    // Strage Bucket
    const storageBucket = new Bucket(this, "StorageBucket", {
      autoDeleteObjects: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    // IAM Role for ECS Task
    const ecsTaskRole = new Role(this, "EcsTaskRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Attach S3 access policy to the role
    ecsTaskRole.addToPolicy(
      new PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
        resources: [storageBucket.bucketArn, `${storageBucket.bucketArn}/*`],
      })
    );

    // ALB
    const alb = new Alb(this, "Alb", {
      vpc,
      allowedCidrs: props.allowedCidrs,
      subDomain: props.subDomainName,
      hostedZone,
    });

    // 1. WAF Web ACLの作成
    const webAcl = new CfnWebACL(this, "WebAcl", {
      defaultAction: { allow: {} }, // デフォルトは許可、必要に応じて変更
      scope: "REGIONAL", // ALBの場合はREGIONAL, CloudFrontの場合はCLOUDFRONT
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "difyWebAcl", //metricsName,
        sampledRequestsEnabled: true,
      },
      rules: [
        // ここにルールを追加。例：AWS Managed Rules
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "awsManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        // 必要に応じて他のルールを追加
      ],
    });

    // 2. WAF Web ACLをALBに関連付け
    new CfnWebACLAssociation(this, "WebAclAssociation", {
      resourceArn: alb.loadBalancerArn, // ALBのARN
      webAclArn: webAcl.attrArn,
    });

    const postgres = new Postgres(this, "Postgres", {
      vpc,
      scalesToZero: props.enableAuroraScalesToZero ?? false,
    });

    // DifyをECSで起動する
    const api = new ApiService(this, "ApiService", {
      cluster,
      alb,
      postgres,
      redis,
      storageBucket,
      imageTag,
      sandboxImageTag,
      allowAnySyscalls,
    });

    new WebService(this, "WebService", {
      cluster,
      alb,
      imageTag,
    });

    new WorkerService(this, "WorkerService", {
      cluster,
      postgres,
      redis,
      storageBucket,
      encryptionSecret: api.encryptionSecret,
      imageTag,
    });

    new cdk.CfnOutput(this, "DifyUrl", {
      value: alb.url,
    });
  }
}

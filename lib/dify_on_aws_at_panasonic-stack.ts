import * as cdk from 'aws-cdk-lib';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  NatProvider,
  SubnetType,
  IVpc,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
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
}

export class DifyOnAwsAtPanasonicStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DifyOnAwsStackProps) {
    super(scope, id, props);
    const {
      difyImageTag: imageTag = 'latest',
      difySandboxImageTag: sandboxImageTag = 'latest',
      allowAnySyscalls = false,
    } = props;
    // Create a VPC
    let vpc: IVpc;
    vpc = new Vpc(this, 'Vpc', {
      ...(props.cheapVpc
        ? {
          natGatewayProvider: NatProvider.instanceV2({
            instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.NANO),
          }),
          natGateways: 1,
        }
        : {}),
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Public',
          // NAT instance does not work when this set to false.
          // mapPublicIpOnLaunch: false,
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: 'Private',
        },
      ],
    });

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DifyOnAwsAtPanasonicQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}

# CDK time-sleep
AWS CDK equivalent for Terraform's [time_sleep resource](https://registry.terraform.io/providers/hashicorp/time/latest/docs/resources/sleep).

For those who want to add intentional sleeps between creation or deletion of resources.

## Usage
Install via npm:

```sh
npm i cdk-time-sleep
```

And use it from AWS CDK code.

```ts
const queue1 = new Queue(this, 'Queue1');
const sleep10s = new TimeSleep(this, 'Sleep10seconds', {
    createDuration: Duration.seconds(10),
});
const queue2 = new Queue(this, 'Queue2');

// create queue2 (at least) 10 seconds after creating queue1
sleep10s.node.addDependency(queue1);
queue2.node.addDependency(sleep10s);
```

```ts
const queue1 = new Queue(this, 'Queue1');
const sleep10s = new TimeSleep(this, 'Sleep10seconds', {
    destroyDuration: Duration.seconds(10),
});
const queue2 = new Queue(this, 'Queue2');

// destroy queue1 (at least) 10 seconds after destroying queue2
sleep10s.node.addDependency(queue1);
queue2.node.addDependency(sleep10s);
```

## For maintainers
```sh
# Deploy a test stack
cd test
npx cdk deploy --app "npx ts-node integ.time-sleep.ts" IntegTest
```

import type { Handler } from 'aws-lambda';
import type { ResourceProperties } from '../src/types';
import { setTimeout } from 'timers/promises';

type Event = {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: ResourceProperties;
};

export const handler: Handler<Event> = async (event, context) => {
  try {
    switch (event.RequestType) {
      case 'Create':
        await setTimeout(event.ResourceProperties.createDurationSeconds * 1000);
        break;
      case 'Update':
        // await setTimeout(event.ResourceProperties.createDurationSeconds * 1000);
        break;
      case 'Delete':
        await setTimeout(event.ResourceProperties.destroyDurationSeconds * 1000);
        break;
    }
    await sendStatus('SUCCESS', event, context);
  } catch (e) {
    console.log(e);
    const err = e as Error;
    await sendStatus('FAILED', event, context, err.message);
  }
};

const sendStatus = async (status: 'SUCCESS' | 'FAILED', event: Event, context: any, reason?: string) => {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason ?? 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: {},
  });

  await fetch(event.ResponseURL, {
    method: 'PUT',
    body: responseBody,
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length.toString(),
    },
  });
};

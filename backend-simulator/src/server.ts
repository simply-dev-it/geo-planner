import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { routeInteractiveApi } from './interactive-api.js';
import { createInteractiveSimulatorState } from './interactive-scenarios.js';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4300;
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;

const HEALTH_PATH = '/_simulator/health';

export interface SimulatorResponse {
  readonly body: Readonly<Record<string, unknown>>;
  readonly contentType: string;
  readonly correlationId: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotencyReplayed?: boolean;
  readonly location?: string;
  readonly rawBody?: Buffer;
  readonly status: number;
}

function correlationId(request: IncomingMessage): string {
  const requested = request.headers['x-correlation-id'];
  return typeof requested === 'string' && requested.length <= 128 ? requested : randomUUID();
}

export function routeRequest(
  method: string | undefined,
  requestUrl: string | undefined,
  requestCorrelationId: string,
  bodyText?: string,
  headers: IncomingMessage['headers'] = {},
  state = createInteractiveSimulatorState(),
  bodyTooLarge = false,
): SimulatorResponse {
  let url: URL;
  try {
    url = new URL(requestUrl ?? '/', `http://${DEFAULT_HOST}`);
  } catch {
    return problemResponse(requestCorrelationId, 400, 'INVALID_REQUEST', 'Invalid request URL.');
  }

  if (bodyTooLarge) {
    return problemResponse(
      requestCorrelationId,
      413,
      'REQUEST_TOO_LARGE',
      'Request body exceeds the simulator limit.',
    );
  }

  if (method === 'GET' && url.pathname === HEALTH_PATH) {
    return {
      body: {
        service: 'geo-planner-contract-simulator',
        status: 'ready',
        mode: 'offline-fixtures',
        providerAccess: 'disabled',
        projectStorage: 'in-memory-only',
      },
      contentType: 'application/json',
      correlationId: requestCorrelationId,
      status: 200,
    };
  }

  const interactiveResponse = routeInteractiveApi(
    method,
    url,
    bodyText,
    headers,
    requestCorrelationId,
    state,
  );
  if (interactiveResponse) {
    return interactiveResponse;
  }

  return {
    body: {
      type: 'about:blank',
      title: 'No simulated contract route',
      status: 404,
      detail: 'No route exists in the provisional PROJECT-001 fixture simulator.',
    },
    contentType: 'application/problem+json',
    correlationId: requestCorrelationId,
    status: 404,
  };
}

function problemResponse(
  correlationId: string,
  status: number,
  errorCode: string,
  detail: string,
): SimulatorResponse {
  return {
    body: {
      type: `https://geo-planner.invalid/problems/${errorCode.toLowerCase()}`,
      title: 'Simulator request rejected',
      status,
      errorCode,
      detail,
      correlationId,
    },
    contentType: 'application/problem+json',
    correlationId,
    status,
  };
}

function sendResponse(response: ServerResponse, simulatorResponse: SimulatorResponse): void {
  const payload = simulatorResponse.rawBody ?? Buffer.from(JSON.stringify(simulatorResponse.body));

  response.writeHead(simulatorResponse.status, {
    'cache-control': 'no-store',
    'content-length': payload.byteLength,
    'content-type': simulatorResponse.rawBody
      ? simulatorResponse.contentType
      : `${simulatorResponse.contentType}; charset=utf-8`,
    'x-correlation-id': simulatorResponse.correlationId,
    ...simulatorResponse.headers,
    ...(simulatorResponse.location ? { location: simulatorResponse.location } : {}),
    ...(simulatorResponse.idempotencyReplayed ? { 'idempotency-replayed': 'true' } : {}),
  });
  response.end(payload);
}

export function createContractSimulator(): Server {
  const state = createInteractiveSimulatorState();

  return createServer((request, response) => {
    const chunks: Buffer[] = [];
    let requestBytes = 0;
    let bodyTooLarge = false;

    request.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      requestBytes += buffer.length;
      if (requestBytes > MAX_REQUEST_BODY_BYTES) {
        bodyTooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!bodyTooLarge) {
        chunks.push(buffer);
      }
    });

    request.on('end', () => {
      const bodyText = bodyTooLarge ? undefined : Buffer.concat(chunks).toString('utf8');
      sendResponse(
        response,
        routeRequest(
          request.method,
          request.url,
          correlationId(request),
          bodyText,
          request.headers,
          state,
          bodyTooLarge,
        ),
      );
    });
  });
}

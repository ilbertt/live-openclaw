import { isClientRequest, type Json, type Reply } from '#protocol.ts';
import type { GatewayService } from '#services/gateway.service.ts';
import type { OfferService } from '#services/offer.service.ts';
export class ConnectorController {
  constructor(
    private readonly gateway: Pick<GatewayService, 'request'>,
    private readonly offers: Pick<OfferService, 'exchange'>,
  ) {}
  async handle(payload: unknown): Promise<Reply> {
    try {
      if (!isClientRequest(payload)) throw new Error('Unsupported bridge request');
      const result: Json =
        payload.type === 'rpc'
          ? await this.gateway.request(payload.method, payload.params)
          : await this.offers.exchange(payload);
      return { type: 'result', id: payload.id, result };
    } catch (error) {
      const id =
        typeof payload === 'object' &&
        payload !== null &&
        'id' in payload &&
        typeof payload.id === 'string'
          ? payload.id
          : '';
      return {
        type: 'error',
        id,
        message: error instanceof Error ? error.message : 'Bridge error',
      };
    }
  }
}

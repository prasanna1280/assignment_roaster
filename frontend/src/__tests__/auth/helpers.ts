import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import type { ApiError, TokenResponse } from '../../types';

export const tokens: TokenResponse = {
  access_token: 'access-123',
  refresh_token: 'refresh-456',
  token_type: 'bearer',
};

/** Build an AxiosError carrying a backend ApiError body. */
export function apiError(status: number, body: ApiError): AxiosError<ApiError> {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse<ApiError> = {
    data: body,
    status,
    statusText: String(status),
    headers: {},
    config,
  };
  return new AxiosError<ApiError>(body.detail, 'ERR_BAD_REQUEST', config, undefined, response);
}

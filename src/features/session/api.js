import { apiRequest } from '../../lib/api/client.js';

export const sessionApi = {
  createGhlMvpSession: ({ locationId, userId }) => apiRequest('/v1/sessions/gohighlevel/session', {
    method: 'POST',
    body: {
      location_id: locationId,
      user_id: userId,
    },
  }),
  testGhlMvpConnection: ({ locationId }) => apiRequest('/v1/sessions/gohighlevel/test', {
    method: 'POST',
    body: {
      location_id: locationId,
    },
  }),
};

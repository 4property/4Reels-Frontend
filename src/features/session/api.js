import { apiRequest } from '../../lib/api/client.js';

export const sessionApi = {
  /** Returns the currently signed-in user with their resolved `permissions` map. */
  getCurrentUser: () => apiRequest('/me'),
  createGhlMvpSession: ({ locationId, userId }) => apiRequest('/mvp/gohighlevel/session', {
    method: 'POST',
    body: {
      location_id: locationId,
      user_id: userId,
    },
  }),
  testGhlMvpConnection: ({ locationId }) => apiRequest('/mvp/gohighlevel/test', {
    method: 'POST',
    body: {
      location_id: locationId,
    },
  }),
};

/**
 * Profile API – matches backend profile routes.
 */
import farelyApi from './farelyApi';

export const profileApi = {
  getProfile: () => farelyApi.get('/profile'),
  updateProfile: (body) => farelyApi.put('/profile', body),
  uploadPhoto: (formData) =>
    farelyApi.post('/profile/photo', formData, {
      transformRequest: (data, headers) => {
        delete headers['Content-Type'];
        return data;
      },
    }),
};

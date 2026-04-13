/**
 * Auth API – matches backend routes for easy frontend-backend communication.
 * Base URL from config/api.js; token handled by farelyApi interceptor.
 */
import farelyApi from './farelyApi';

export const authApi = {
  signup: (body) => farelyApi.post('/auth/signup', body),
  resendOtp: (body) => farelyApi.post('/auth/resend-otp', body),
  verifyOtp: (body) => farelyApi.post('/auth/verify-otp', body),
  setPassword: (body) => farelyApi.post('/auth/set-password', body),
  login: (body) => farelyApi.post('/auth/login', body),
  getMe: () => farelyApi.get('/auth/me'),
  google: (body) => farelyApi.post('/auth/google', body),
  forgotPassword: (body) => farelyApi.post('/auth/forgot-password', body),
  verifyForgotPasswordOtp: (body) => farelyApi.post('/auth/verify-forgot-password-otp', body),
  resetPassword: (body) => farelyApi.post('/auth/reset-password', body),
  /** Logged-in only: currentPassword, newPassword, confirmNewPassword */
  changePassword: (body) => farelyApi.post('/auth/change-password', body),
};

import farelyApi from './farelyApi';

export async function fetchPaymentMethods() {
  const res = await farelyApi.get('/payment-methods');
  return Array.isArray(res.data) ? res.data : [];
}

export async function createPaymentMethod(payload) {
  const res = await farelyApi.post('/payment-methods', payload);
  return res.data?.paymentMethod;
}

export async function updatePaymentMethod(id, payload) {
  const res = await farelyApi.patch(`/payment-methods/${id}`, payload);
  return res.data?.paymentMethod;
}

export async function deletePaymentMethod(id) {
  await farelyApi.delete(`/payment-methods/${id}`);
}

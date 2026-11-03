// A failed response is not evidence that the transaction failed to commit.
export async function completeWithConfirmation(salesApi, payload) {
  try { return await salesApi.complete(payload); }
  catch (error) {
    if (!error.status || error.status >= 500) {
      try {
        const { sale } = await salesApi.operation(payload.client_operation_id);
        if (sale) return sale;
      } catch { /* Keep the draft and its operation ID when confirmation is unavailable. */ }
      throw Object.assign(new Error('Não foi possível confirmar a venda. A operação foi mantida. Confira e tente novamente; não registre a venda em outro caixa antes de conferir o histórico.'), { uncertain: true });
    }
    throw error;
  }
}

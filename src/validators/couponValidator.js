/**
 * couponValidator.js
 *
 * Validacoes de negocio para cupons.
 * Modulo separado para isolar regras de validacao — SRP (Clean Code).
 */

/**
 * Verifica se o cupom esta dentro do periodo de validade.
 *
 * @param {Object} coupon          - { code, expiresAt: Date }
 * @param {Date}   referenceDate   - Data de referencia (injetada para testabilidade)
 * @returns {{ valid: boolean, reason?: string }}
 */
function isCouponExpired(coupon, referenceDate = new Date()) {
  if (!coupon || !coupon.expiresAt) {
    return { valid: false, reason: "Cupom sem data de validade definida." };
  }

  const expiry = new Date(coupon.expiresAt);
  if (referenceDate > expiry) {
    return { valid: false, reason: "Cupom expirado em " + expiry.toLocaleDateString("pt-BR") + "." };
  }

  return { valid: true };
}

/**
 * Verifica se o pedido atinge o valor minimo exigido pelo cupom.
 *
 * @param {number} orderTotal      - Valor total do pedido.
 * @param {number} minimumAmount   - Valor minimo exigido pelo cupom.
 * @returns {{ valid: boolean, reason?: string }}
 */
function meetsMinimumOrderAmount(orderTotal, minimumAmount) {
  if (typeof orderTotal !== "number" || typeof minimumAmount !== "number") {
    return { valid: false, reason: "Valores invalidos para verificacao de minimo." };
  }

  if (orderTotal < minimumAmount) {
    return {
      valid: false,
      reason:
        "Pedido abaixo do valor minimo. Necessario: R$" +
        minimumAmount.toFixed(2) +
        ", atual: R$" +
        orderTotal.toFixed(2) +
        ".",
    };
  }

  return { valid: true };
}

module.exports = {
  isCouponExpired,
  meetsMinimumOrderAmount,
};

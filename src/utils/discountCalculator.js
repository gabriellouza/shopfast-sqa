/**
 * discountCalculator.js
 *
 * Funcoes puras de calculo de desconto.
 * Sem dependencias externas — 100% testavel e deterministica.
 */

/**
 * Calcula o valor do desconto absoluto.
 *
 * @param {number} amount          - Valor base.
 * @param {number} discountPercent - Percentual de desconto (0-100).
 * @returns {number} Valor do desconto.
 */
function calculateDiscount(amount, discountPercent) {
  return parseFloat(((amount * discountPercent) / 100).toFixed(2));
}

/**
 * Calcula o valor final apos desconto.
 *
 * @param {number} amount          - Valor base.
 * @param {number} discountPercent - Percentual de desconto (0-100).
 * @returns {number} Valor final.
 */
function calculateFinalAmount(amount, discountPercent) {
  const discount = calculateDiscount(amount, discountPercent);
  return parseFloat((amount - discount).toFixed(2));
}

/**
 * Formata um valor numerico para moeda brasileira (BRL).
 *
 * @param {number} amount - Valor a formatar.
 * @returns {string} Valor formatado (ex: "R$ 500,00").
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

module.exports = {
  calculateDiscount,
  calculateFinalAmount,
  formatCurrency,
};

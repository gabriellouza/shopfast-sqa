/**
 * couponService.js
 *
 * Servico de dominio: aplicacao de cupom de desconto.
 *
 * PRINCIPIOS APLICADOS (Clean Code — Robert C. Martin):
 *   - SRP: esta funcao faz UMA coisa — orquestrar a aplicacao do cupom.
 *   - Zero Coupling: nenhuma dependencia de infraestrutura e instanciada aqui.
 *     Todas chegam via injecao de parametro (paymentGateway, stockService).
 *   - Testabilidade: cada dependencia pode ser substituida por um mock simples.
 *
 * CONFORMIDADE IEEE 730-2014:
 *   - §5.4.3: produto avaliavel contra requisito estabelecido (saldo x desconto).
 *   - §5.5.2: processo auditavel — sem efeitos colaterais ocultos.
 *
 * REGRA DE NEGOCIO CENTRAL (o que falhou na Black Friday):
 *   O desconto do cupom DEVE ser validado contra o saldo disponivel ANTES
 *   de qualquer despacho logistico. Sem essa validacao, o sistema despacha
 *   sem cobertura financeira real.
 */

/**
 * Aplica um cupom de desconto a um pedido e processa o pagamento.
 *
 * @param {Object} order           - Dados do pedido (id, total, items, paymentMethod, customerEmail).
 * @param {Object} coupon          - Dados do cupom (code, discountPercent).
 * @param {Object} paymentGateway  - Servico de pagamento (injetado): { checkBalance, charge }
 * @param {Object} stockService    - Servico de estoque (injetado): { reserveItems, releaseItems }
 * @param {Object} notifier        - Servico de notificacao (injetado): { sendConfirmation }
 * @returns {{ success: boolean, message: string, finalAmount?: number }}
 */
function applyCouponAndProcess(order, coupon, paymentGateway, stockService, notifier) {
  const validationResult = validateCouponApplicationInput(order, coupon);
  if (!validationResult.valid) {
    return { success: false, message: validationResult.reason };
  }

  const finalAmount = calculateDiscountedAmount(order.total, coupon.discountPercent);

  // ── VERIFICACAO CRITICA: saldo antes de qualquer despacho ─────────────────
  // Esta e a validacao que estava AUSENTE no incidente da Black Friday.
  // O sistema original despachou sem verificar se o cartao cobria o valor
  // descontado. Esta linha impede que isso aconteca novamente.
  const balanceCheck = paymentGateway.checkBalance(order.paymentMethod, finalAmount);
  if (!balanceCheck.sufficient) {
    return {
      success: false,
      message:
        "Saldo insuficiente. Necessario: R$" +
        finalAmount.toFixed(2) +
        ", disponivel: R$" +
        balanceCheck.available.toFixed(2) +
        ".",
    };
  }

  const stockCheck = stockService.reserveItems(order.items);
  if (!stockCheck.reserved) {
    return { success: false, message: "Estoque insuficiente para um ou mais itens do pedido." };
  }

  const payment = paymentGateway.charge(order.paymentMethod, finalAmount);
  if (!payment.success) {
    stockService.releaseItems(order.items);
    return { success: false, message: "Falha ao processar pagamento." };
  }

  notifier.sendConfirmation(order.customerEmail, order.id, finalAmount);

  return { success: true, message: "Pedido confirmado.", finalAmount };
}

/**
 * Valida os dados de entrada antes de qualquer operacao financeira.
 * Funcao pura — sem efeitos colaterais.
 *
 * @param {Object} order
 * @param {Object} coupon
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCouponApplicationInput(order, coupon) {
  if (!order || typeof order.total !== "number" || order.total <= 0) {
    return { valid: false, reason: "Pedido invalido ou valor zerado." };
  }

  if (!coupon || typeof coupon.discountPercent !== "number") {
    return { valid: false, reason: "Cupom invalido." };
  }

  if (coupon.discountPercent < 0 || coupon.discountPercent > 100) {
    return { valid: false, reason: "Percentual de desconto fora do intervalo permitido (0-100)." };
  }

  if (!order.paymentMethod) {
    return { valid: false, reason: "Metodo de pagamento nao informado." };
  }

  return { valid: true };
}

/**
 * Calcula o valor final apos aplicacao do desconto.
 * Funcao pura — deterministica, sem dependencias externas.
 *
 * @param {number} originalAmount   - Valor original do pedido.
 * @param {number} discountPercent  - Percentual de desconto (0-100).
 * @returns {number} Valor final com desconto aplicado.
 */
function calculateDiscountedAmount(originalAmount, discountPercent) {
  const discount = (originalAmount * discountPercent) / 100;
  return parseFloat((originalAmount - discount).toFixed(2));
}

module.exports = {
  applyCouponAndProcess,
  validateCouponApplicationInput,
  calculateDiscountedAmount,
};

/**
 * couponFlow.test.js
 *
 * Teste de integracao controlado para o fluxo completo de cupom.
 *
 * DIFERENCA em relacao aos testes unitarios:
 *   - Os servicos colaboram entre si (nao sao mocks simples).
 *   - Valida o comportamento do FLUXO, nao de funcoes isoladas.
 *   - Ainda sem I/O real — usa implementacoes fake controladas.
 */

const { applyCouponAndProcess } = require("../../src/services/couponService");

// ── IMPLEMENTACOES FAKE (controladas, sem I/O real) ───────────────────────────

function createFakePaymentGateway(balances = {}) {
  const ledger = { ...balances };

  return {
    checkBalance(paymentMethod, amount) {
      const available = ledger[paymentMethod.token] || 0;
      return { sufficient: available >= amount, available };
    },
    charge(paymentMethod, amount) {
      if ((ledger[paymentMethod.token] || 0) < amount) {
        return { success: false };
      }
      ledger[paymentMethod.token] -= amount;
      return { success: true };
    },
  };
}

function createFakeStockService(inventory = {}) {
  const stock = { ...inventory };
  const reserved = {};

  return {
    reserveItems(items) {
      for (const item of items) {
        if ((stock[item.sku] || 0) < item.qty) {
          return { reserved: false };
        }
      }
      for (const item of items) {
        stock[item.sku] -= item.qty;
        reserved[item.sku] = (reserved[item.sku] || 0) + item.qty;
      }
      return { reserved: true };
    },
    releaseItems(items) {
      for (const item of items) {
        stock[item.sku] = (stock[item.sku] || 0) + item.qty;
        reserved[item.sku] = Math.max(0, (reserved[item.sku] || 0) - item.qty);
      }
    },
  };
}

function createFakeNotifier() {
  const sent = [];
  return {
    sendConfirmation(email, orderId, amount) {
      sent.push({ email, orderId, amount });
    },
    getSent() {
      return sent;
    },
  };
}

// ── TESTES DE INTEGRACAO ───────────────────────────────────────────────────────

describe("Fluxo Completo — BLACK50 (integracao)", () => {
  it("deve processar pedido completo com cupom 50% e saldo suficiente", () => {
    const paymentGateway = createFakePaymentGateway({ tok_valid: 600 });
    const stockService = createFakeStockService({ "IPHONE-15": 5 });
    const notifier = createFakeNotifier();

    const order = {
      id: "ORD-BF-001",
      total: 1000,
      items: [{ sku: "IPHONE-15", qty: 1 }],
      paymentMethod: { type: "credit_card", token: "tok_valid" },
      customerEmail: "cliente@shopfast.com",
    };

    const result = applyCouponAndProcess(
      order,
      { code: "BLACK50", discountPercent: 50 },
      paymentGateway,
      stockService,
      notifier
    );

    expect(result.success).toBe(true);
    expect(result.finalAmount).toBe(500);
    expect(notifier.getSent()).toHaveLength(1);
    expect(notifier.getSent()[0].amount).toBe(500);
  });

  it("deve REJEITAR quando saldo e menor que valor apos desconto", () => {
    // Cenario Black Friday: cartao com R$200, pedido de R$1000 com 50% off = R$500
    const paymentGateway = createFakePaymentGateway({ tok_fraco: 200 });
    const stockService = createFakeStockService({ "IPHONE-15": 5 });
    const notifier = createFakeNotifier();

    const order = {
      id: "ORD-BF-002",
      total: 1000,
      items: [{ sku: "IPHONE-15", qty: 1 }],
      paymentMethod: { type: "credit_card", token: "tok_fraco" },
      customerEmail: "cliente@shopfast.com",
    };

    const result = applyCouponAndProcess(
      order,
      { code: "BLACK50", discountPercent: 50 },
      paymentGateway,
      stockService,
      notifier
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Saldo insuficiente");
    // Estoque NAO deve ter sido reservado
    expect(notifier.getSent()).toHaveLength(0);
  });
});

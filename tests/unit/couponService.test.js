/**
 * couponService.test.js
 *
 * Testes unitarios do servico de cupom.
 *
 * ESTRATEGIA DE TESTE (Clean Code + IEEE 730):
 *   - Todas as dependencias externas sao MOCKS — sem I/O real.
 *   - Cada teste cobre UM cenario especifico (SRP para testes).
 *   - Cenarios negativos sao obrigatorios: saldo insuficiente, cupom invalido,
 *     estoque zerado — exatamente o que faltou na Black Friday.
 *
 * COBERTURA MINIMA EXIGIDA (Quality Gate — Regra 1):
 *   Branches: 90% em src/services/
 */

const {
  applyCouponAndProcess,
  validateCouponApplicationInput,
  calculateDiscountedAmount,
} = require("../../src/services/couponService");

// ── FACTORIES DE MOCK ──────────────────────────────────────────────────────────

function makeOrder(overrides = {}) {
  return {
    id: "ORD-001",
    total: 1000,
    items: [{ sku: "IPHONE-15", qty: 1 }],
    paymentMethod: { type: "credit_card", token: "tok_valid" },
    customerEmail: "cliente@shopfast.com",
    ...overrides,
  };
}

function makeCoupon(overrides = {}) {
  return {
    code: "BLACK50",
    discountPercent: 50,
    ...overrides,
  };
}

function makePaymentGateway({
  balanceSufficient = true,
  chargeSuccess = true,
  available = 1000,
} = {}) {
  return {
    checkBalance: jest.fn(() => ({ sufficient: balanceSufficient, available })),
    charge: jest.fn(() => ({ success: chargeSuccess })),
  };
}

function makeStockService({ reserved = true } = {}) {
  return {
    reserveItems: jest.fn(() => ({ reserved })),
    releaseItems: jest.fn(),
  };
}

function makeNotifier() {
  return { sendConfirmation: jest.fn() };
}

// ── GRUPO 1: CENARIO DE SUCESSO ────────────────────────────────────────────────

describe("applyCouponAndProcess — Cenario de Sucesso", () => {
  it("deve confirmar pedido com cupom BLACK50 quando saldo e suficiente", () => {
    const order = makeOrder({ total: 1000 });
    const coupon = makeCoupon({ discountPercent: 50 });
    const paymentGateway = makePaymentGateway({ balanceSufficient: true, available: 600 });
    const stockService = makeStockService({ reserved: true });
    const notifier = makeNotifier();

    const result = applyCouponAndProcess(
      order, coupon, paymentGateway, stockService, notifier
    );

    expect(result.success).toBe(true);
    expect(result.finalAmount).toBe(500); // 1000 - 50%
    expect(paymentGateway.checkBalance).toHaveBeenCalledWith(order.paymentMethod, 500);
    expect(paymentGateway.charge).toHaveBeenCalledWith(order.paymentMethod, 500);
    expect(notifier.sendConfirmation).toHaveBeenCalledWith(
      "cliente@shopfast.com",
      "ORD-001",
      500
    );
  });
});

// ── GRUPO 2: FALHA DE SALDO — O CENARIO DA BLACK FRIDAY ───────────────────────

describe("applyCouponAndProcess — Falha de Saldo (cenario Black Friday)", () => {
  /**
   * ESTE E O TESTE QUE TERIA BLOQUEADO O DESASTRE.
   * O cupom BLACK50 reduzia o valor de R$1000 para R$500.
   * O cartao tinha R$200 disponiveis.
   * O sistema original despachou mesmo assim — nunca verificou o saldo.
   */
  it("deve REJEITAR o pedido quando saldo do cartao e insuficiente para o valor descontado", () => {
    const order = makeOrder({ total: 1000 });
    const coupon = makeCoupon({ discountPercent: 50 }); // finalAmount = 500
    const paymentGateway = makePaymentGateway({ balanceSufficient: false, available: 200 });
    const stockService = makeStockService();
    const notifier = makeNotifier();

    const result = applyCouponAndProcess(
      order, coupon, paymentGateway, stockService, notifier
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Saldo insuficiente");
    expect(result.message).toContain("500.00");
    expect(result.message).toContain("200.00");

    // CRITICO: sem despacho sem cobertura financeira
    expect(paymentGateway.charge).not.toHaveBeenCalled();
    expect(stockService.reserveItems).not.toHaveBeenCalled();
    expect(notifier.sendConfirmation).not.toHaveBeenCalled();
  });

  it("deve rejeitar pedido com saldo exatamente zero", () => {
    const paymentGateway = makePaymentGateway({ balanceSufficient: false, available: 0 });

    const result = applyCouponAndProcess(
      makeOrder(), makeCoupon(), paymentGateway, makeStockService(), makeNotifier()
    );

    expect(result.success).toBe(false);
    expect(paymentGateway.charge).not.toHaveBeenCalled();
  });
});

// ── GRUPO 3: VALIDACAO DE ENTRADAS ────────────────────────────────────────────

describe("applyCouponAndProcess — Validacao de Entradas", () => {
  it("deve rejeitar pedido com total zerado", () => {
    const result = applyCouponAndProcess(
      makeOrder({ total: 0 }), makeCoupon(),
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("invalido");
  });

  it("deve rejeitar pedido nulo", () => {
    const result = applyCouponAndProcess(
      null, makeCoupon(),
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
  });

  it("deve rejeitar cupom com desconto negativo", () => {
    const result = applyCouponAndProcess(
      makeOrder(), makeCoupon({ discountPercent: -10 }),
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("intervalo");
  });

  it("deve rejeitar cupom com desconto acima de 100%", () => {
    const result = applyCouponAndProcess(
      makeOrder(), makeCoupon({ discountPercent: 150 }),
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
  });

  it("deve rejeitar pedido sem metodo de pagamento", () => {
    const result = applyCouponAndProcess(
      makeOrder({ paymentMethod: null }), makeCoupon(),
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("pagamento");
  });

  it("deve rejeitar cupom sem discountPercent", () => {
    const result = applyCouponAndProcess(
      makeOrder(), { code: "X" },
      makePaymentGateway(), makeStockService(), makeNotifier()
    );
    expect(result.success).toBe(false);
  });
});

// ── GRUPO 4: FALHA DE ESTOQUE ──────────────────────────────────────────────────

describe("applyCouponAndProcess — Falha de Estoque", () => {
  it("deve rejeitar pedido quando estoque nao pode ser reservado", () => {
    const stockService = makeStockService({ reserved: false });
    const paymentGateway = makePaymentGateway({ balanceSufficient: true });

    const result = applyCouponAndProcess(
      makeOrder(), makeCoupon(), paymentGateway, stockService, makeNotifier()
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Estoque insuficiente");
    expect(paymentGateway.charge).not.toHaveBeenCalled();
  });
});

// ── GRUPO 5: FALHA NO GATEWAY DE PAGAMENTO ────────────────────────────────────

describe("applyCouponAndProcess — Falha no Gateway de Pagamento", () => {
  it("deve liberar reserva de estoque quando cobranca falha", () => {
    const stockService = makeStockService({ reserved: true });
    const paymentGateway = makePaymentGateway({
      balanceSufficient: true,
      chargeSuccess: false,
    });
    const notifier = makeNotifier();

    const result = applyCouponAndProcess(
      makeOrder(), makeCoupon(), paymentGateway, stockService, notifier
    );

    expect(result.success).toBe(false);
    expect(stockService.releaseItems).toHaveBeenCalled(); // rollback de estoque
    expect(notifier.sendConfirmation).not.toHaveBeenCalled();
  });
});

// ── GRUPO 6: calculateDiscountedAmount (funcao pura) ──────────────────────────

describe("calculateDiscountedAmount — Funcao Pura", () => {
  it("deve calcular 50% de desconto corretamente", () => {
    expect(calculateDiscountedAmount(1000, 50)).toBe(500);
  });

  it("deve calcular 0% de desconto (sem alteracao)", () => {
    expect(calculateDiscountedAmount(1000, 0)).toBe(1000);
  });

  it("deve calcular 100% de desconto (gratuito)", () => {
    expect(calculateDiscountedAmount(1000, 100)).toBe(0);
  });

  it("deve arredondar para 2 casas decimais", () => {
    expect(calculateDiscountedAmount(100, 33)).toBe(67);
  });
});

// ── GRUPO 7: validateCouponApplicationInput (funcao pura) ─────────────────────

describe("validateCouponApplicationInput — Validacao Pura", () => {
  it("deve retornar valido para entradas corretas", () => {
    const result = validateCouponApplicationInput(makeOrder(), makeCoupon());
    expect(result.valid).toBe(true);
  });

  it("deve retornar invalido para order undefined", () => {
    const result = validateCouponApplicationInput(undefined, makeCoupon());
    expect(result.valid).toBe(false);
  });

  it("deve retornar invalido para coupon sem discountPercent", () => {
    const result = validateCouponApplicationInput(makeOrder(), { code: "X" });
    expect(result.valid).toBe(false);
  });
});

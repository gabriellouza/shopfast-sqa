# ShopFast SQA — Plano de Garantia de Qualidade (SQAP)

> **Arquiteto de Qualidade (SQA) | Ciclo 02**
> Disciplina: Qualidade de Software — Prof. Carlos Roberto Gomes Junior
> Aluno: Gabriel Alves Louza - 2320508
---

## Estrutura do Repositorio

```
shopfast-sqa/
├── .github/
│   └── workflows/
│       └── quality-gate.yml        ← Pipeline CI — Quality Gates automaticos
├── src/
│   ├── services/
│   │   └── couponService.js        ← Dominio refatorado (Clean Code + DI)
│   ├── validators/
│   │   └── couponValidator.js      ← Validacoes isoladas e puras
│   └── utils/
│       └── discountCalculator.js   ← Calculo de desconto — funcao pura
├── tests/
│   ├── unit/
│   │   └── couponService.test.js   ← Testes unitarios (mocks, sem I/O)
│   └── integration/
│       └── couponFlow.test.js      ← Teste de integracao controlado
├── .eslintrc.json                  ← Enforcement: Zero Coupling Gate
├── .gitignore
├── jest.config.js                  ← Enforcement: Coverage Gate
├── package.json
└── README.md                       ← Este documento (SQAP)
```

---

## Contexto: O Desastre da Black Friday

Na ultima Black Friday, o sistema processou o cupom `BLACK50` validando apenas a **renderizacao visual** da barra de desconto. A camada de pagamento **nunca cruzou o saldo disponivel no cartao com o valor descontado**. O sistema logistico despachou unidades sem cobertura financeira real.

**Classificacao do Incidente (IEEE 730, §5.4.3 — Evaluate Product for Conformance):**
Nao-conformidade critica por ausencia de validacao de requisito funcional na cadeia de integracao pagamento x estoque x despacho.

---

## A. Politica do Quality Gate — 2 Regras Imutaveis

Baseado na **IEEE 730-2014, Clausula 5.3.3 (Document SQA Planning)** e **Clausula 5.4.2 (Evaluate Plans for Conformance)**, as seguintes regras constituem os portoes de qualidade inegociaveis desta base de codigo. **Nenhum release pode contorna-las.**

---

### REGRA 1 — Cobertura Minima Obrigatoria em Camadas de Negocio Criticas

**Enunciado:**
Toda funcao classificada como **camada de negocio financeiro** (cupom, desconto, pagamento, frete) deve possuir cobertura de testes unitarios >= 90% de branches, incluindo **obrigatoriamente** os cenarios de saldo insuficiente, cupom invalido e valor negativo.

**Enforcement Automatizado:**

```yaml
# .github/workflows/quality-gate.yml
- name: "[GATE 1] Jest — Coverage Threshold Check"
  run: npx jest --ci
  # jest.config.js define os thresholds.
  # Se nao atingidos, jest retorna exit code 1 e o pipeline para.
```

```js
// jest.config.js
coverageThreshold: {
  "./src/services/": { branches: 90, functions: 90, lines: 90, statements: 90 }
}
```

**Origem da Regra (IEEE 730-2014):**
§5.4.3 — "Non-conformances are raised when software products do not conform to established software requirements." O requisito de validacao de saldo e estabelecido — logo, a ausencia de teste que o cubra e **nao-conformidade auditavel**.

**O que teria impedido o desastre:**
O test case `deve_rejeitar_desconto_quando_saldo_insuficiente` teria falhado em CI antes de qualquer merge, bloqueando o release defeituoso.

---

### REGRA 2 — Proibicao de Dependencias Diretas em Funcoes de Dominio (Zero Coupling)

**Enunciado:**
Nenhuma funcao de dominio financeiro pode instanciar ou chamar diretamente implementacoes de infraestrutura (`fetch`, `db.query`, `axios`, SDKs de pagamento). Toda dependencia externa deve ser injetada via parametro ou interface. Violacoes bloqueiam o pipeline.

**Enforcement Automatizado:**

```yaml
# .github/workflows/quality-gate.yml
- name: "[GATE 2] ESLint — Zero Coupling Check"
  run: npx eslint src/ --max-warnings=0
  # Qualquer acoplamento direto = pipeline falha com exit code 1
```

```json
// .eslintrc.json
"no-restricted-imports": ["error", { "patterns": ["axios", "pg", "mysql", "stripe"] }],
"no-restricted-globals": ["error", { "name": "fetch" }]
```

**Origem da Regra (IEEE 730-2014):**
§5.5.2 — "Evaluate life cycle processes and plans for conformance." Codigo acoplado nao e auditavel, nao e mockavel e nao e testavel — logo viola o processo de garantia de produto.

**O que teria impedido o desastre:**
A funcao original `processarPedido()` chamava `fetch()` e `db.query()` diretamente. ESLint teria recusado o commit. O codigo nao chegaria nem a revisao de pares.

---

## B. Sumario Executivo — Gestao de Risco (Matriz P x I)

### Classificacao do Incidente

| Risco Identificado                                       | Probabilidade | Impacto | Score    | Acao     |
|----------------------------------------------------------|---------------|---------|----------|----------|
| Despacho logistico sem cobertura financeira              | Alta          | Alto    | CRITICO  | Mitigar  |
| Cupom aceito sem cruzamento com saldo do cartao          | Alta          | Alto    | CRITICO  | Mitigar  |
| Acoplamento direto impedindo isolamento de testes        | Media         | Medio   | Alto     | Evitar   |

> Fonte: IEEE 730-2014, Annex I — Software Integrity Levels; §4.6.2 — Software Product Risks.

### Justificativa Executiva (Change Failure Rate — DORA)

O incidente da Black Friday nao foi uma falha de codigo isolada — foi uma falha de **governanca de processo** (IEEE 730-2014, §5.3.1). A ausencia de um Quality Gate automatizado permitiu que uma nao-conformidade de nivel critico (§5.4.3) transitasse por todas as fases do SDLC sem impedimento. O resultado direto foi um aumento abrupto no **Change Failure Rate (CFR)**: cada release passou a carregar risco sistemico nao rastreado, pois o pipeline nao possuia mecanismo de bloqueio baseado em evidencia objetiva de qualidade.

A implementacao das 2 regras deste SQAP atua diretamente na **prevencao** (SQA), nao na deteccao tardia (SQC). A Regra 1 garante que toda camada financeira tenha evidencia objetiva de conformidade antes de qualquer merge — reduzindo o CFR ao tornar impossivel o deploy de codigo sem cobertura de branches criticos. A Regra 2 elimina o acoplamento que tornava os testes impossiveis, restabelecendo a cadeia de auditabilidade exigida pela IEEE 730 (§5.5.2). Juntas, as regras criam um **sistema** de qualidade com enforcement automatizado que nao depende de disciplina individual, mas de infraestrutura de pipeline que bloqueia antes que o risco se materialize em producao.

---

## Como Executar Localmente

```bash
# Instalar dependencias
npm install

# Rodar apenas os testes
npm test

# Rodar lint + testes com cobertura (Quality Gate completo)
npm run quality-gate
```

---

## Rastreabilidade IEEE 730-2014

| Atividade SQA                    | Clausula IEEE 730 | Implementacao neste Repositorio          |
|----------------------------------|-------------------|------------------------------------------|
| Estabelecer padroes de processo  | §5.3.1            | `.eslintrc.json` + `jest.config.js`      |
| Documentar planejamento SQA      | §5.3.3            | Este `README.md`                         |
| Avaliar conformidade de produto  | §5.4.3            | `tests/unit/couponService.test.js`       |
| Avaliar conformidade de processo | §5.5.2            | `.github/workflows/quality-gate.yml`     |
| Avaliar ambientes                | §5.5.3            | `jest.config.js` (ambiente isolado)      |

---

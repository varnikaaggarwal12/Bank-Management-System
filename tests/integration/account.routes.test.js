const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../app");

/**
 * 🔴 MOCK CONTROLLER COMPLETELY
 */
jest.mock("../../controllers/accountController", () => ({
  deposit: jest.fn((req, res) =>
    res.status(200).json({ balance: 1500 })
  ),
  withdraw: jest.fn((req, res) =>
    res.status(200).json({ balance: 1200 })
  ),
  transfer: jest.fn(),
  openAccount: jest.fn(),
  login: jest.fn(),
  updatePin: jest.fn(),
  deleteAccount: jest.fn(),
  getTransactionHistory: jest.fn()
}));

describe("ACCOUNT ROUTES – INTEGRATION TESTS", () => {
  let token;

  beforeAll(() => {
    token = jwt.sign(
      { accountNumber: "12345" },
      process.env.JWT_SECRET || "testsecret"
    );
  });

  test("DEPOSIT – authorized user", async () => {
    const res = await request(app)
      .post("/api/accounts/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500 });

    expect(res.statusCode).toBe(200);
    expect(res.body.balance).toBe(1500);
  });

  test("WITHDRAW – authorized user", async () => {
    const res = await request(app)
      .post("/api/accounts/withdraw")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 300 });

    expect(res.statusCode).toBe(200);
    expect(res.body.balance).toBe(1200);
  });

  test("BLOCK request without token", async () => {
    const res = await request(app)
      .post("/api/accounts/deposit")
      .send({ amount: 100 });

    expect(res.statusCode).toBe(401);
  });
});

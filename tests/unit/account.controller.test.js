jest.mock("../../config/db", () => ({
  prisma: {
    account: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    transaction: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock("../../services/messageQueue", () => ({
  enqueueTransaction: jest.fn()
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn()
}));

const { prisma } = require("../../config/db");
const { enqueueTransaction } = require("../../services/messageQueue");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  openAccount,
  login,
  deposit,
  withdraw
} = require("../../controllers/accountController");

describe("ACCOUNT CONTROLLER – UNIT TESTS", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { accountNumber: "123456" },
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    jest.clearAllMocks();
  });

  // OPEN ACCOUNT
  test("openAccount creates new account", async () => {
    bcrypt.hash.mockResolvedValue("hashedPin");

    prisma.account.create.mockResolvedValue({
      accountNumber: "123456"
    });

    req.body = { name: "Rashi", pin: "1234" };

    await openAccount(req, res);

    expect(prisma.account.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumber: "123456" })
    );
  });

  //lOGIn
  test("login returns JWT on success", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 1,
      pin: "hashedPin",
      accountNumber: "123456"
    });

    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("fake-token");

    req.body = { accountNumber: "123456", pin: "1234" };

    await login(req, res);

    expect(jwt.sign).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: "fake-token" })
    );
  });

  //dEPOSIT
  test("deposit updates balance", async () => {
    prisma.account.update.mockResolvedValue({ balance: 1500 });
    prisma.transaction.create.mockResolvedValue({});
    enqueueTransaction.mockResolvedValue();

    req.body = { amount: 500 };

    await deposit(req, res);

    expect(prisma.account.update).toHaveBeenCalled();
    expect(enqueueTransaction).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 1500 })
    );
  });

  // wITHdRAW
  test("withdraw updates balance", async () => {
    prisma.account.findUnique.mockResolvedValue({ balance: 1000 });
    prisma.account.update.mockResolvedValue({ balance: 800 });
    prisma.transaction.create.mockResolvedValue({});
    enqueueTransaction.mockResolvedValue();

    req.body = { amount: 200 };

    await withdraw(req, res);

    expect(prisma.account.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 800 })
    );
  });
});

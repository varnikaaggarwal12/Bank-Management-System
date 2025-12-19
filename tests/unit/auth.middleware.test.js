const auth = require("../../middleware/authMiddleware");

describe("AUTH MIDDLEWARE – UNIT TESTS", () => {

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("blocks request if token is missing", () => {
    const req = { headers: {} };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("blocks request if token is invalid", () => {
    const req = {
      headers: {
        authorization: "Bearer invalid.token",
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const next = jest.fn();

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

export const mockClient = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
};

export const Client = jest.fn(() => mockClient);

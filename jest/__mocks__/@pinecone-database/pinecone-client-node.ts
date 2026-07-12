export const PineconeRecordManager = jest.fn(() => ({
  query: jest.fn().mockResolvedValue({ matches: [] }),
}));

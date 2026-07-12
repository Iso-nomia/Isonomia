import express from "express";
import request from "supertest";

let store: any[] = [];

jest.mock("@/lib/prismaclient", () => {
  return {
    prisma: {
      article: {
        create: jest.fn(({ data }) => {
          const article = { ...data, id: "1" };
          store.push(article);
          return Promise.resolve(article);
        }),
        findMany: jest.fn(() => Promise.resolve(store)),
      },
    },
  };
});

// describe("articles api", () => {
//   it("creates article", async () => {
//     process.env.BASIC_AUTH = Buffer.from("user:pass").toString("base64");
//     const handler = (await import("@/app/api/articles/")).default;

//     const app = express();
//     app.use(express.json());
//     app.post("/api/articles", (req, res) => handler(req, res));

//     const resp = await request(app)
//       .post("/api/articles")
//       .set("Authorization", `Basic ${process.env.BASIC_AUTH}`)
//       .send({
//         authorId: "u1",
//         title: "t",
//         slug: "s",
//         astJson: {},
//       });

//     expect(resp.status).toBe(201);
//     expect(resp.body.id).toBeDefined();
//     expect(store.length).toBe(1);
//   });
// });

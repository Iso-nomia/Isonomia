
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prismaclient";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { serverConfig } from "../lib/firebase/config";
import {
  updateUserEmbedding,
  generateFriendSuggestions,
} from "../lib/actions/friend-suggestions.actions";

initializeApp({
  credential: cert(serverConfig.serviceAccount),
});

const GLOBAL_ROOM_ID = "global";

const firstNames = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
];

const lastNames = [
  "Anderson",
  "Brown",
  "Clark",
  "Davis",
  "Edwards",
  "Franklin",
  "Garcia",
  "Harris",
  "Iverson",
  "Johnson",
];

const samplePosts = [
  "Hello world!",
  "Enjoying my time here.",
  "What a great day!",
  "Just posting a quick update.",
  "Learning new things every day.",
];

const sampleArtists = [
  "The Beatles",
  "Taylor Swift",
  "Kendrick Lamar",
  "Radiohead",
  "Beyonce",
  "Nirvana",
  "Miles Davis",
];

const sampleAlbums = [
  "Abbey Road",
  "1989",
  "To Pimp a Butterfly",
  "OK Computer",
  "Lemonade",
  "Nevermind",
  "Kind of Blue",
];

const sampleSongs = [
  "Imagine",
  "Bohemian Rhapsody",
  "Hey Jude",
  "Hotel California",
  "Shake It Off",
  "Blinding Lights",
  "Smells Like Teen Spirit",
];

const sampleMovies = [
  "The Matrix",
  "Inception",
  "Interstellar",
  "The Lord of the Rings",
  "The Shawshank Redemption",
  "The Godfather",
  "Pulp Fiction",
  "Forrest Gump",
];

const sampleBooks = [
  "1984",
  "The Hobbit",
  "To Kill a Mockingbird",
  "Harry Potter",
  "The Great Gatsby",
  "Moby Dick",
  "Pride and Prejudice",
];

const sampleInterests = [
  "Rock Climbing",
  "Skydiving",
  "Scuba Diving",
  "Hiking",
  "Kayaking/Canoeing",
  "Stargazing",
  "Cycling",
  "Camping",
  "Surfing",
  "Dancing",
];

const sampleHobbies = [
  "Photography",
  "Cooking",
  "Chess",
  "Writing",
  "Running",
  "Gardening",
  "Gaming",
];

const sampleCommunities = [
  "Book Club",
  "Sports Fans",
  "Yoga Group",
  "Artists",
  "Musicians",
  "Travelers",
  "Foodies",
];

const sampleLocations = [
  "New York",
  "San Francisco",
  "London",
  "Tokyo",
  "Berlin",
  "Sydney",
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function createSampleData() {
  const userIds: bigint[] = [];
  await prisma.realtimeRoom.upsert({
    where: { id: GLOBAL_ROOM_ID },
    update: {},
    create: { id: GLOBAL_ROOM_ID, room_icon: "/assets/logo-black.svg" },
  });

  for (let i = 0; i < firstNames.length; i++) {
    const first = firstNames[i];
    const last = getRandom(lastNames);
    const name = `${first} ${last}`;
    const username = `${first.toLowerCase()}${i}`;
    const email = `${username}@example.com`;
    const password = "password123";

    let authId: string;
    try {
      const firebaseUser = await getAuth().createUser({
        email,
        password,
      });
      authId = firebaseUser.uid;
    } catch (err: any) {
      if (err.code === "auth/email-already-exists") {
        const existing = await getAuth().getUserByEmail(email);
        authId = existing.uid;
      } else {
        throw err;
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { auth_id: authId },
    });

    let user = existingUser;
    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          auth_id: authId,
          username,
          name,
          bio: `Bio for ${name}`,
          onboarded: true,
        },
      });
    }

    await prisma.userRealtimeRoom.upsert({
      where: {
        user_id_realtime_room_id: {
          user_id: user.id,
          realtime_room_id: GLOBAL_ROOM_ID,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        realtime_room_id: GLOBAL_ROOM_ID,
      },
    });

    const userAttrData = {
      artists: { set: getRandomSubset(sampleArtists, 1, 3) },
      albums: { set: getRandomSubset(sampleAlbums, 1, 3) },
      songs: { set: getRandomSubset(sampleSongs, 1, 3) },
      interests: { set: getRandomSubset(sampleInterests, 2, 4) },
      movies: { set: getRandomSubset(sampleMovies, 1, 3) },
      books: { set: getRandomSubset(sampleBooks, 1, 3) },
      location: getRandom(sampleLocations),
      hobbies: { set: getRandomSubset(sampleHobbies, 1, 3) },
      communities: { set: getRandomSubset(sampleCommunities, 1, 2) },
      birthday: new Date(
        Date.UTC(
          1980 + Math.floor(Math.random() * 20),
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        )
      ),
    };

    await prisma.userAttributes.upsert({
      where: { user_id: user.id },
      update: userAttrData,
      create: { user_id: user.id, ...userAttrData },
    });

    if (!existingUser) {
      const postCount = 3;
      for (let j = 0; j < postCount; j++) {
        const content = `${getRandom(samplePosts)} (${j + 1})`;

        await prisma.feedPost.create({
          data: {
            content,
            author_id: user.id,
          },
        });

        await prisma.realtimePost.create({
          data: {
            content,
            author_id: user.id,
            realtime_room_id: GLOBAL_ROOM_ID,
            x_coordinate: new Prisma.Decimal(Math.random() * 100),
            y_coordinate: new Prisma.Decimal(Math.random() * 100),
            type: "TEXT",
            locked: false,
            isPublic: false,
          },
        });
      }
    }

    userIds.push(user.id);
  }

  for (const id of userIds) {
    await updateUserEmbedding(id);
  }

  for (const id of userIds) {
    await generateFriendSuggestions(id);
  }
}

createSampleData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

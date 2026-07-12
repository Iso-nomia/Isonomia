-- CreateEnum
CREATE TYPE "like_type" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "realtime_post_type" AS ENUM ('TEXT', 'VIDEO', 'IMAGE', 'LIVESTREAM', 'IMAGE_COMPUTE', 'COLLAGE', 'GALLERY', 'PORTAL', 'AUDIO', 'DRAW', 'LIVECHAT', 'DOCUMENT', 'THREAD', 'CODE', 'PORTFOLIO', 'LLM_INSTRUCTION', 'MUSIC');

-- CreateEnum
CREATE TYPE "visibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "auth_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "bio" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_attributes" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "artists" TEXT[],
    "albums" TEXT[],
    "songs" TEXT[],
    "interests" TEXT[],
    "movies" TEXT[],
    "birthday" TIMESTAMP(3),
    "communities" TEXT[],
    "hobbies" TEXT[],
    "location" TEXT,
    "books" TEXT[],
    "events_visibility" "visibility" NOT NULL DEFAULT 'PUBLIC',
    "tv_visibility" "visibility" NOT NULL DEFAULT 'PUBLIC',
    "podcasts_visibility" "visibility" NOT NULL DEFAULT 'PUBLIC',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "parent_id" BIGINT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "expiration_date" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "type" "like_type" NOT NULL DEFAULT 'LIKE',
    "user_id" BIGINT NOT NULL,
    "post_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_likes" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "type" "like_type" NOT NULL DEFAULT 'LIKE',
    "user_id" BIGINT NOT NULL,
    "realtime_post_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realtime_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_rooms" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "room_icon" TEXT NOT NULL,

    CONSTRAINT "realtime_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_posts" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT,
    "image_url" TEXT,
    "video_url" TEXT,
    "author_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "x_coordinate" DECIMAL(65,30) NOT NULL,
    "y_coordinate" DECIMAL(65,30) NOT NULL,
    "type" "realtime_post_type" NOT NULL DEFAULT 'TEXT',
    "realtime_room_id" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "collageLayoutStyle" TEXT,
    "collageColumns" INTEGER,
    "collageGap" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" BIGINT,

    CONSTRAINT "realtime_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_edges" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "source_node_id" BIGINT NOT NULL,
    "target_node_id" BIGINT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "realtime_room_id" TEXT NOT NULL,

    CONSTRAINT "realtime_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_realtime_rooms" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "realtime_room_id" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_realtime_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realtime_room_invite_tokens" (
    "id" BIGSERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiration_date" TIMESTAMP(3),
    "realtime_room_id" TEXT NOT NULL,
    "inviting_user_id" BIGINT NOT NULL,

    CONSTRAINT "realtime_room_invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" BIGSERIAL NOT NULL,
    "follower_id" BIGINT NOT NULL,
    "following_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archived_posts" (
    "id" BIGSERIAL NOT NULL,
    "original_post_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6),
    "parent_id" BIGINT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "expiration_date" TIMESTAMP(3),
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_embeddings" (
    "user_id" BIGINT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_embeddings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "friend_suggestions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "suggested_user_id" BIGINT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" BIGSERIAL NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "graph" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" BIGSERIAL NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "from_state_id" BIGINT NOT NULL,
    "to_state_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_attribute_edits" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attribute_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_clicks" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "recommended_user_id" BIGINT,
    "recommended_room_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_workflows" (
    "id" BIGSERIAL NOT NULL,
    "workflow_id" BIGINT NOT NULL,
    "cron" TEXT,
    "trigger" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_attributes_user_id_key" ON "user_attributes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_post_id_user_id_key" ON "likes"("post_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "realtime_likes_realtime_post_id_user_id_key" ON "realtime_likes"("realtime_post_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "realtime_edges_source_node_id_target_node_id_key" ON "realtime_edges"("source_node_id", "target_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_realtime_rooms_user_id_realtime_room_id_key" ON "users_realtime_rooms"("user_id", "realtime_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "realtime_room_invite_tokens_token_key" ON "realtime_room_invite_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "archived_posts_original_post_id_key" ON "archived_posts"("original_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "friend_suggestions_user_id_suggested_user_id_key" ON "friend_suggestions"("user_id", "suggested_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflow_id_version_key" ON "workflow_states"("workflow_id", "version");

-- AddForeignKey
ALTER TABLE "user_attributes" ADD CONSTRAINT "user_attributes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_likes" ADD CONSTRAINT "realtime_likes_realtime_post_id_fkey" FOREIGN KEY ("realtime_post_id") REFERENCES "realtime_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_likes" ADD CONSTRAINT "realtime_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_posts" ADD CONSTRAINT "realtime_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_posts" ADD CONSTRAINT "realtime_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "realtime_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_posts" ADD CONSTRAINT "realtime_posts_realtime_room_id_fkey" FOREIGN KEY ("realtime_room_id") REFERENCES "realtime_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_edges" ADD CONSTRAINT "realtime_edges_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_edges" ADD CONSTRAINT "realtime_edges_realtime_room_id_fkey" FOREIGN KEY ("realtime_room_id") REFERENCES "realtime_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_edges" ADD CONSTRAINT "realtime_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "realtime_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_edges" ADD CONSTRAINT "realtime_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "realtime_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_realtime_rooms" ADD CONSTRAINT "users_realtime_rooms_realtime_room_id_fkey" FOREIGN KEY ("realtime_room_id") REFERENCES "realtime_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_realtime_rooms" ADD CONSTRAINT "users_realtime_rooms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_room_invite_tokens" ADD CONSTRAINT "realtime_room_invite_tokens_inviting_user_id_fkey" FOREIGN KEY ("inviting_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_room_invite_tokens" ADD CONSTRAINT "realtime_room_invite_tokens_realtime_room_id_fkey" FOREIGN KEY ("realtime_room_id") REFERENCES "realtime_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archived_posts" ADD CONSTRAINT "archived_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_embeddings" ADD CONSTRAINT "user_embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_suggestions" ADD CONSTRAINT "friend_suggestions_suggested_user_id_fkey" FOREIGN KEY ("suggested_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_suggestions" ADD CONSTRAINT "friend_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_attribute_edits" ADD CONSTRAINT "user_attribute_edits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_clicks" ADD CONSTRAINT "recommendation_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_workflows" ADD CONSTRAINT "scheduled_workflows_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

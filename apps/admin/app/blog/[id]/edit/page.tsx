import type { Id } from "../../../../../../convex/_generated/dataModel";
import { StoryEditor } from "../../story-editor";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoryEditor postId={id as Id<"blogPosts">} />;
}

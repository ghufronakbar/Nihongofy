import { notFound, redirect } from "next/navigation";
import { getPublishedBunpouKey } from "@/features/bunpou/queries";

type Props = {
  params: Promise<{ pointId: string }>;
  searchParams: Promise<{ comment?: string | string[] }>;
};

/**
 * Pengalih id → key. Baris catatan hanya membawa `bunpouPointId`, sedangkan
 * halaman pola memakai `key`; pembentuk tautan diskusi (`target.ts`) cukup
 * memakai id dan route inilah yang menerjemahkannya. Diskusi sendiri dibaca di
 * `/bunpou/<key>#diskusi`.
 */
export default async function BunpouDiscussionRedirect({ params, searchParams }: Props) {
  const [{ pointId: rawPointId }, { comment }] = await Promise.all([params, searchParams]);
  const pointId = Number(rawPointId);
  if (!Number.isInteger(pointId) || pointId <= 0) notFound();

  const key = await getPublishedBunpouKey(pointId);
  if (!key) notFound();

  const commentId = Number(Array.isArray(comment) ? comment[0] : comment);
  const anchor = Number.isInteger(commentId) && commentId > 0 ? `comment-${commentId}` : "diskusi";
  redirect(`/bunpou/${key}#${anchor}`);
}

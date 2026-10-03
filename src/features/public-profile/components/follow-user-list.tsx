import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profilePath } from "../access";
import type { FollowListUser } from "../follow-queries";

/**
 * Daftar akun untuk halaman follower, following, dan permintaan follow.
 * `action` merender tombol per baris (setujui/tolak, hapus follower).
 */
export function FollowUserList({
  users,
  emptyText,
  action,
}: {
  users: FollowListUser[];
  emptyText: string;
  action?: (user: FollowListUser) => React.ReactNode;
}) {
  if (users.length === 0) {
    return (
      <p className="neo-surface bg-white p-6 text-center font-semibold text-black/60">{emptyText}</p>
    );
  }

  return (
    <ul className="neo-surface divide-y-2 divide-black/10 bg-white">
      {users.map((user) => {
        const href = profilePath(user.username, true);
        return (
          <li key={user.id} className="flex flex-wrap items-center gap-4 p-4">
            <Avatar className="size-12 rounded-md border-2 border-black bg-neo-blue">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" className="rounded-[4px]" /> : null}
              <AvatarFallback className="rounded-[4px] bg-neo-blue font-black text-black">
                {user.displayName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {href ? (
                <Link href={href} className="font-black break-words hover:underline">
                  {user.displayName}
                </Link>
              ) : (
                <span className="font-black break-words">{user.displayName}</span>
              )}
              <p className="font-mono text-xs font-bold break-all text-black/60">@{user.username}</p>
              {user.bio ? <p className="mt-1 line-clamp-2 text-sm text-black/70">{user.bio}</p> : null}
            </div>
            {action ? <div className="ml-auto shrink-0">{action(user)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

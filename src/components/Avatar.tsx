import type { UserAccount } from "../lib/auth";
import { initialsOf } from "../lib/names";

/** Мұғалімнің аватары: жүктелген сурет болмаса — аты-жөнінің бас әріптері. */
export function Avatar({
  user,
  className = "h-10 w-10 rounded-xl text-[13px]",
  tone = "bg-fuchsia-100 text-fuchsia-700",
}: {
  user: Pick<UserAccount, "name" | "avatarUrl">;
  className?: string;
  tone?: string;
}) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`shrink-0 object-cover ${className}`} />;
  }
  return <span className={`flex shrink-0 items-center justify-center font-bold ${tone} ${className}`}>{initialsOf(user.name)}</span>;
}

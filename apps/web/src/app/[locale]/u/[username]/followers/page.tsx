import {
  FollowListPage,
  followListMetadata,
  type FollowListProps,
} from "@/components/social/FollowListPage";

export const generateMetadata = (props: FollowListProps) => followListMetadata(props, "followers");

export default function FollowersPage(props: FollowListProps) {
  return <FollowListPage {...props} direction="followers" />;
}

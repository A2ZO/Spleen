import {
  FollowListPage,
  followListMetadata,
  type FollowListProps,
} from "@/components/social/FollowListPage";

export const generateMetadata = (props: FollowListProps) => followListMetadata(props, "following");

export default function FollowingPage(props: FollowListProps) {
  return <FollowListPage {...props} direction="following" />;
}
